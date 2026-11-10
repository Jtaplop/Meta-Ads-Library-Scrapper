"""
test_log_parser.py — Unit tests for ANSI stripping, Loguru output parser, and final status computation.
"""

from __future__ import annotations

from api.log_parser import (
    LogParser,
    compute_final_status,
    strip_ansi,
    update_job_with_parse_result,
)
from api.schemas import Job, JobPhase, JobProgress, JobStatus, ScrapeRequest, SearchMode


def test_strip_ansi():
    raw = "\x1b[32m2026-11-10 12:00:00\x1b[0m | \x1b[1;34mINFO\x1b[0m     | Starting scrape"
    clean = strip_ansi(raw)
    assert clean == "2026-11-10 12:00:00 | INFO     | Starting scrape"
    assert "\x1b" not in clean


def test_parser_loguru_and_fallback():
    parser = LogParser()

    # Loguru formatted line
    res1 = parser.parse_line("2026-11-10 14:15:30 | DEBUG    | Loading cache items")
    assert res1.log_entry.ts == "2026-11-10 14:15:30"
    assert res1.log_entry.level == "DEBUG"
    assert res1.log_entry.message == "Loading cache items"
    assert res1.log_entry.seq == 1

    # Non-loguru fallback line (stdout print or stack trace)
    res2 = parser.parse_line("Random trace: line 42 in module.py")
    assert res2.log_entry.level == "INFO"
    assert res2.log_entry.message == "Random trace: line 42 in module.py"
    assert res2.log_entry.seq == 2


def test_parser_lifecycle_rules():
    parser = LogParser()
    job = Job(
        id="test1",
        request=ScrapeRequest(mode=SearchMode.keyword, query="test"),
        command=["python", "main.py"],
        progress=JobProgress(limit=50),
        created_at="2026-11-10T12:00:00",
    )

    # 1. Starting scrape
    res = parser.parse_line("2026-11-10 12:00:00 | INFO     | Starting scrape | keyword=test")
    update_job_with_parse_result(job, res)
    assert job.phase == JobPhase.starting

    # 2. Browser launched
    res = parser.parse_line("2026-11-10 12:00:01 | INFO     | Browser launched successfully")
    update_job_with_parse_result(job, res)
    assert job.phase == JobPhase.browser

    # 3. Search URL & Navigating
    res = parser.parse_line("2026-11-10 12:00:02 | INFO     | Search URL: https://www.facebook.com/ads/library/?q=test")
    update_job_with_parse_result(job, res)
    assert job.phase == JobPhase.navigating
    assert job.search_url == "https://www.facebook.com/ads/library/?q=test"

    # 4. Retry warning
    res = parser.parse_line("2026-11-10 12:00:03 | WARNING  | Retry attempt 1 due to timeout")
    update_job_with_parse_result(job, res)
    assert res.warning is not None
    assert res.warning.kind == "retry"
    assert job.progress.retries == 1

    # 5. Scroll iteration & collecting
    res = parser.parse_line("2026-11-10 12:00:04 | INFO     | Scroll iteration 1/50")
    update_job_with_parse_result(job, res)
    assert job.phase == JobPhase.collecting
    assert job.progress.iteration == 1
    assert job.progress.max_iterations == 50

    # 6. Iteration new ads
    res = parser.parse_line("2026-11-10 12:00:05 | INFO     | Iteration 1: +5 new ads | total=5")
    update_job_with_parse_result(job, res)
    assert job.progress.collected == 5

    # 7. Stagnant detection
    res = parser.parse_line("2026-11-10 12:00:06 | INFO     | No new ads on iteration 2 (stagnant=2/5)")
    update_job_with_parse_result(job, res)
    assert job.progress.stagnant == 2
    assert job.progress.stagnant_threshold == 5

    # 8. Unique IG profiles
    res = parser.parse_line("2026-11-10 12:00:07 | INFO     | total unique profiles so far: 4")
    update_job_with_parse_result(job, res)
    assert job.progress.unique_ig_profiles == 4

    # 9. Raw ads collected -> validating phase
    res = parser.parse_line("2026-11-10 12:00:08 | INFO     | Collected 10 unique raw ads")
    update_job_with_parse_result(job, res)
    assert job.phase == JobPhase.validating
    assert job.progress.raw_unique == 10

    # 10. Validated ads
    res = parser.parse_line("2026-11-10 12:00:09 | INFO     | Validated 8 ads (discarded 2)")
    update_job_with_parse_result(job, res)
    assert job.progress.validated == 8
    assert job.progress.discarded == 2

    # 11. Validation warning
    res = parser.parse_line("2026-11-10 12:00:10 | WARNING  | Validation failed for ad_id 12345: missing snapshot")
    assert res.warning is not None
    assert res.warning.kind == "validation"

    # 12. Exporting
    res = parser.parse_line("2026-11-10 12:00:11 | INFO     | Collected 8 ads | exporting as CSV")
    update_job_with_parse_result(job, res)
    assert job.phase == JobPhase.exporting

    # 13. Done output written
    res = parser.parse_line("Done. Output written to: output/test_20261110_120000.csv")
    update_job_with_parse_result(job, res)
    assert job.result_file == "test_20261110_120000.csv"
    assert job.phase == JobPhase.finished


def test_parser_empty_and_error():
    parser = LogParser()
    job = Job(
        id="test2",
        request=ScrapeRequest(mode=SearchMode.keyword, query="empty"),
        command=["python", "main.py"],
        progress=JobProgress(limit=50),
        created_at="2026-11-10T12:00:00",
    )

    res = parser.parse_line("2026-11-10 12:00:05 | INFO     | No ads matched the criteria.")
    assert res.empty_matched is True

    err_res = parser.parse_line("2026-11-10 12:00:06 | ERROR    | Playwright execution timed out")
    update_job_with_parse_result(job, err_res)
    assert job.error == "Playwright execution timed out"


def test_compute_final_status():
    # Cancelled
    assert compute_final_status(cancelled=True, exit_code=0, result_file="out.csv", empty_matched=False) == JobStatus.cancelled
    assert compute_final_status(cancelled=False, exit_code=130, result_file=None, empty_matched=False) == JobStatus.cancelled

    # Succeeded
    assert compute_final_status(cancelled=False, exit_code=0, result_file="out.csv", empty_matched=False) == JobStatus.succeeded

    # Empty
    assert compute_final_status(cancelled=False, exit_code=0, result_file=None, empty_matched=True) == JobStatus.empty

    # Failed (error exit code)
    assert compute_final_status(cancelled=False, exit_code=1, result_file=None, empty_matched=False) == JobStatus.failed

    # Failed (exit 0 without result file or empty flag)
    assert compute_final_status(cancelled=False, exit_code=0, result_file=None, empty_matched=False) == JobStatus.failed
