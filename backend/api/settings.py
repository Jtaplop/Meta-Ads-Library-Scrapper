"""
settings.py — Configuration and environment paths for the FastAPI bridge.
"""

from __future__ import annotations

import os
import sys
from pathlib import Path

# Ensure sys.path includes BACKEND_DIR so 'import config' works cleanly regardless of cwd or import style.
BACKEND_DIR = Path(__file__).resolve().parents[1]
if str(BACKEND_DIR) not in sys.path:
    sys.path.insert(0, str(BACKEND_DIR))

import config  # noqa: E402

CLI_ENTRY: Path = Path(os.getenv("MAS_CLI_ENTRY", str(BACKEND_DIR / "main.py"))).resolve()
OUTPUT_DIR: Path = Path(os.getenv("MAS_OUTPUT_DIR", str(BACKEND_DIR / config.OUTPUT_DIR))).resolve()
DATA_DIR: Path = Path(os.getenv("MAS_DATA_DIR", str(BACKEND_DIR / "api" / "data"))).resolve()
PYTHON_EXE: str = os.getenv("MAS_PYTHON_EXE", sys.executable)
JOB_PAUSE_SECONDS: int = int(os.getenv("MAS_JOB_PAUSE_SECONDS", "150"))
MAX_LOG_LINES_IN_MEMORY: int = int(os.getenv("MAS_MAX_LOG_LINES_IN_MEMORY", "5000"))
HOST: str = os.getenv("MAS_HOST", "127.0.0.1")
PORT: int = int(os.getenv("MAS_PORT", "8000"))
CORS_ORIGINS: list[str] = [
    "http://localhost:5173",
    "http://127.0.0.1:5173",
]
FRONTEND_DIST: Path = (BACKEND_DIR.parent / "frontend" / "dist").resolve()

# Ensure DATA_DIR and logs subfolder exist
(DATA_DIR / "logs").mkdir(parents=True, exist_ok=True)
