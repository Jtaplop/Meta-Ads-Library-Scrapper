"""
log_parser.py — ANSI strip, Loguru format parser, and event extractor.
"""

from __future__ import annotations

import re
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Any

from api.schemas import Job, JobPhase, JobProgress, JobStatus, LogEntry, WarningEvent

# ANSI escape sequence regex
ANSI_REGEX = re.compile(r"\x1b\[[0-9;]*[A-Za-z]")

# Loguru default format configured in main.py:
# <time:YYYY-MM-DD HH:mm:ss> | <level> | <message>
LOGURU_REGEX = re.compile(
    r"^(?P<ts>\d{4}-\d{2}-\d{2} \d{2}:\d{2}:\d{2}) \| (?P<level>\w+)\s*\| (?P<msg>.*)$"
)

# Regex rules on msg (SPEC-API §6.3)
RE_STARTING = re.compile(r"^Starting scrape \|")
RE_BROWSER = re.compile(r"^Browser launched")
RE_SEARCH_URL = re.compile(r"^Search URL: (?P<url>\S+)")
RE_NAV_OK = re.compile(r"^(Navigation successful|Navigation aborted by redirect)")
RE_NAV_WARNING = re.compile(r"(Navigation failed|Navigation timeout|Navigation error)", re.IGNORECASE)
RE_RETRY = re.compile(r"^Retry attempt (?P<n>\d+)")
RE_SCROLL_ITER = re.compile(r"^Scroll iteration (?P<i>\d+)/(?P<max>\d+)")
RE_ITER_NEW_ADS = re.compile(r"^Iteration (?P<i>\d+): \+(?P<new>\d+) new ads \| total=(?P<total>\d+)")
RE_STAGNANT = re.compile(r"^No new ads on iteration \d+ \(stagnant=(?P<s>\d+)/(?P<t>\d+)\)")
RE_UNIQUE_IG = re.compile(r"total unique profiles so far: (?P<n>\d+)")
RE_STOPPING = re.compile(r"^Stopping pagination: (?P<reason>.+)")
RE_COLLECTED_RAW = re.compile(r"^Collected (?P<n>\d+) unique raw ads")
RE_VALIDATED = re.compile(r"^Validated (?P<v>\d+) ads \(discarded (?P<d>\d+)\)")
RE_VAL_FAILED = re.compile(r"^Validation failed for ad_id")
RE_EXPORTING = re.compile(r"^Collected (?P<n>\d+) ads .* exporting as (?P<fmt>CSV|JSON)")
RE_NO_ADS = re.compile(r"^No ads matched the criteria")
RE_DONE = re.compile(r"^Done\. Output written to: (?P<path>.+)$")


def strip_ansi(text: str) -> str:
    """Removes ANSI color and style escape codes from text."""
    return ANSI_REGEX.sub("", text)


@dataclass
class ParseResult:
    """Encapsulates the structured output from parsing a single line of log/output."""
    log_entry: LogEntry
    warning: WarningEvent | None = None
    phase: JobPhase | None = None
    search_url: str | None = None
    result_file: str | None = None
    error: str | None = None
    empty_matched: bool = False
    progress_updates: dict[str, Any] = field(default_factory=dict)


class LogParser:
    """
    Maintains parsing state (line sequence counter) and transforms raw CLI output lines
    into structured ParseResult objects. Tolerant of unrecognized lines.
    """

    def __init__(self, initial_seq: int = 0) -> None:
        self.seq = initial_seq

    def parse_line(self, raw_line: str, seq: int | None = None) -> ParseResult:
        """Parses a single raw output line and extracts events, progress, and metadata."""
        if seq is None:
            self.seq += 1
            current_seq = self.seq
        else:
            current_seq = seq
            self.seq = max(self.seq, seq)

        # 1. Strip ANSI codes
        clean_line = strip_ansi(raw_line).rstrip("\r\n")

        # 2. Extract Loguru structure or fallback
        loguru_match = LOGURU_REGEX.match(clean_line)
        if loguru_match:
            ts = loguru_match.group("ts")
            level = loguru_match.group("level").strip().upper()
            msg = loguru_match.group("msg").strip()
        else:
            ts = datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            level = "INFO"
            msg = clean_line.strip()

        log_entry = LogEntry(
            seq=current_seq,
            ts=ts,
            level=level,
            message=msg,
            raw=clean_line,
        )

        warning: WarningEvent | None = None
        phase: JobPhase | None = None
        search_url: str | None = None
        result_file: str | None = None
        error: str | None = None
        empty_matched = False
        progress_updates: dict[str, Any] = {}

        # 3. Apply regex rules on msg
        if RE_STARTING.search(msg):
            phase = JobPhase.starting

        elif RE_BROWSER.search(msg):
            phase = JobPhase.browser

        if m := RE_SEARCH_URL.search(msg):
            search_url = m.group("url")
            phase = JobPhase.navigating

        elif RE_NAV_OK.search(msg):
            phase = JobPhase.navigating

        if m := RE_RETRY.search(msg):
            n = int(m.group("n"))
            progress_updates["retries"] = n
            warning = WarningEvent(kind="retry", message=msg, ts=ts)

        if m := RE_SCROLL_ITER.search(msg):
            phase = JobPhase.collecting
            progress_updates["iteration"] = int(m.group("i"))
            progress_updates["max_iterations"] = int(m.group("max"))

        if m := RE_ITER_NEW_ADS.search(msg):
            progress_updates["collected"] = int(m.group("total"))
            progress_updates["iteration"] = int(m.group("i"))

        if m := RE_STAGNANT.search(msg):
            progress_updates["stagnant"] = int(m.group("s"))
            progress_updates["stagnant_threshold"] = int(m.group("t"))

        if m := RE_UNIQUE_IG.search(msg):
            progress_updates["unique_ig_profiles"] = int(m.group("n"))

        if m := RE_COLLECTED_RAW.search(msg):
            phase = JobPhase.validating
            progress_updates["raw_unique"] = int(m.group("n"))

        if m := RE_VALIDATED.search(msg):
            progress_updates["validated"] = int(m.group("v"))
            progress_updates["discarded"] = int(m.group("d"))

        if RE_VAL_FAILED.search(msg):
            warning = WarningEvent(kind="validation", message=msg, ts=ts)

        if RE_EXPORTING.search(msg):
            phase = JobPhase.exporting

        if RE_NO_ADS.search(msg):
            empty_matched = True

        if m := RE_DONE.search(msg):
            phase = JobPhase.finished
            path_str = m.group("path").strip()
            result_file = Path(path_str).name

        if level == "ERROR":
            error = msg

        if level == "WARNING" and RE_NAV_WARNING.search(msg):
            warning = WarningEvent(kind="navigation", message=msg, ts=ts)

        return ParseResult(
            log_entry=log_entry,
            warning=warning,
            phase=phase,
            search_url=search_url,
            result_file=result_file,
            error=error,
            empty_matched=empty_matched,
            progress_updates=progress_updates,
        )


def update_job_with_parse_result(job: Job, result: ParseResult) -> tuple[bool, bool]:
    """
    Applies extracted updates to a Job and its JobProgress.
    Returns (status_or_phase_changed: bool, progress_changed: bool).
    """
    phase_changed = False
    progress_changed = False

    if result.phase is not None and job.phase != result.phase:
        job.phase = result.phase
        phase_changed = True

    if result.search_url:
        job.search_url = result.search_url

    if result.result_file:
        job.result_file = result.result_file

    if result.error:
        job.error = result.error

    for field_name, value in result.progress_updates.items():
        if hasattr(job.progress, field_name):
            if getattr(job.progress, field_name) != value:
                setattr(job.progress, field_name, value)
                progress_changed = True

    return phase_changed, progress_changed


def compute_final_status(
    cancelled: bool,
    exit_code: int | None,
    result_file: str | None,
    empty_matched: bool,
) -> JobStatus:
    """
    Computes final job status following SPEC-API §6.3:
    - Cancelled / exit 130 -> cancelled
    - exit 0 + result_file -> succeeded
    - exit 0 + empty_matched -> empty
    - Others -> failed
    """
    if cancelled or exit_code == 130:
        return JobStatus.cancelled
    if exit_code == 0:
        if result_file:
            return JobStatus.succeeded
        if empty_matched:
            return JobStatus.empty
    return JobStatus.failed
