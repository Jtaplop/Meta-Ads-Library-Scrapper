"""
runner.py — Subprocess execution, streaming output readers, and process tree termination.
"""

from __future__ import annotations

import asyncio
import os
import signal
import subprocess
import threading
from collections.abc import AsyncIterator
from pathlib import Path

from loguru import logger

from api.settings import BACKEND_DIR


class SubprocessRunner:
    """
    Manages spawning the CLI scraper in an isolated subprocess, streaming its stdout and
    stderr line-by-line via daemon threads into an asyncio.Queue, and providing robust
    tree cancellation on Windows (taskkill /T /F) and POSIX (killpg).
    """

    def __init__(self, cmd: list[str], cwd: Path | str | None = None) -> None:
        self.cmd: list[str] = cmd
        self.cwd: Path = Path(cwd) if cwd else BACKEND_DIR
        self.proc: subprocess.Popen[str] | None = None
        self._is_cancelled: bool = False
        self._lines_queue: asyncio.Queue[tuple[str, str | None]] | None = None
        self._reader_threads: list[threading.Thread] = []

    @property
    def is_cancelled(self) -> bool:
        return self._is_cancelled

    @property
    def pid(self) -> int | None:
        return self.proc.pid if self.proc else None

    def start(self, loop: asyncio.AbstractEventLoop) -> int:
        """
        Launches the subprocess and begins reading stdout/stderr in background threads.
        Returns the PID of the spawned process.
        """
        env = dict(os.environ)
        env["PYTHONUTF8"] = "1"
        env["PYTHONIOENCODING"] = "utf-8"
        env["PYTHONUNBUFFERED"] = "1"

        # Ensure BACKEND_DIR is on PYTHONPATH so main.py can import config, models, etc.
        backend_str = str(self.cwd.resolve())
        existing_py_path = env.get("PYTHONPATH", "")
        env["PYTHONPATH"] = (
            f"{backend_str}{os.pathsep}{existing_py_path}"
            if existing_py_path
            else backend_str
        )

        creationflags = (
            subprocess.CREATE_NEW_PROCESS_GROUP if os.name == "nt" else 0
        )
        start_new_session = os.name != "nt"

        self.proc = subprocess.Popen(
            self.cmd,
            cwd=str(self.cwd.resolve()),
            stdout=subprocess.PIPE,
            stderr=subprocess.PIPE,
            text=True,
            encoding="utf-8",
            errors="replace",
            bufsize=1,
            env=env,
            creationflags=creationflags,
            start_new_session=start_new_session,
        )

        self._lines_queue = asyncio.Queue()

        def _reader(stream, name: str) -> None:
            try:
                for line in iter(stream.readline, ""):
                    loop.call_soon_threadsafe(
                        self._lines_queue.put_nowait, (name, line)
                    )
            except Exception as exc:
                logger.debug(f"Reader exception on {name}: {exc}")
            finally:
                try:
                    stream.close()
                except Exception:
                    pass
                loop.call_soon_threadsafe(
                    self._lines_queue.put_nowait, (name, None)
                )

        t_out = threading.Thread(
            target=_reader,
            args=(self.proc.stdout, "stdout"),
            daemon=True,
            name=f"runner-stdout-{self.proc.pid}",
        )
        t_err = threading.Thread(
            target=_reader,
            args=(self.proc.stderr, "stderr"),
            daemon=True,
            name=f"runner-stderr-{self.proc.pid}",
        )

        self._reader_threads = [t_out, t_err]
        t_out.start()
        t_err.start()

        return self.proc.pid

    async def stream_lines(self) -> AsyncIterator[tuple[str, str]]:
        """
        Asynchronously yields (stream_name, line) until both stdout and stderr reach EOF.
        stream_name is either 'stdout' or 'stderr'.
        """
        if self._lines_queue is None:
            return

        active_streams = 2
        while active_streams > 0:
            stream_name, line = await self._lines_queue.get()
            if line is None:
                active_streams -= 1
            else:
                yield stream_name, line

    def cancel(self) -> None:
        """
        Terminates the process and any spawned child processes (like browser instances).
        """
        self._is_cancelled = True
        if self.proc is None or self.proc.poll() is not None:
            return

        pid = self.proc.pid
        if os.name == "nt":
            try:
                # Forcefully terminate the entire process tree on Windows
                subprocess.run(
                    ["taskkill", "/PID", str(pid), "/T", "/F"],
                    capture_output=True,
                    check=False,
                    timeout=10,
                )
            except Exception as exc:
                logger.warning(f"Error running taskkill on PID {pid}: {exc}")
        else:
            try:
                pgid = os.getpgid(pid)
                os.killpg(pgid, signal.SIGTERM)
            except ProcessLookupError:
                pass
            except Exception as exc:
                logger.warning(f"Error sending SIGTERM to process group {pid}: {exc}")

    async def wait(self) -> int:
        """
        Waits for the process to terminate and returns its exit code.
        """
        if self.proc is None:
            return 0

        loop = asyncio.get_running_loop()
        exit_code = await loop.run_in_executor(None, self.proc.wait)

        for thread in self._reader_threads:
            thread.join(timeout=2.0)

        return exit_code
