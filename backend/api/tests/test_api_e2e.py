"""
test_api_e2e.py — End-to-end API tests covering system, jobs lifecycle, SSE events,
batch queries, results inspection, downloads, merging, and standardized error responses.
"""

from __future__ import annotations

import os
import time
from pathlib import Path

import pytest
from fastapi.testclient import TestClient

from api import settings
from api.jobs import job_manager
from api.results import results_service
from api.server import app

FAKE_MAIN_PATH = (Path(__file__).parent / "fake_main.py").resolve()


@pytest.fixture(autouse=True)
def configure_test_environment(tmp_path: Path):
    """
    Points CLI_ENTRY to fake_main.py, isolates OUTPUT_DIR and DATA_DIR in tmp_path,
    and initializes a clean job_store and results_service for every test.
    """
    orig_cli = settings.CLI_ENTRY
    orig_output = settings.OUTPUT_DIR
    orig_data = settings.DATA_DIR

    test_output = tmp_path / "output"
    test_output.mkdir(parents=True, exist_ok=True)
    test_data = tmp_path / "data"
    test_data.mkdir(parents=True, exist_ok=True)

    settings.CLI_ENTRY = FAKE_MAIN_PATH
    settings.OUTPUT_DIR = test_output
    settings.DATA_DIR = test_data
    os.environ["MAS_OUTPUT_DIR"] = str(test_output)

    # Re-initialize job_store with the new test_data directory
    job_manager.job_store.__init__(data_dir=test_data)
    results_service._custom_output_dir = test_output
    results_service._row_cache.clear()

    yield

    settings.CLI_ENTRY = orig_cli
    settings.OUTPUT_DIR = orig_output
    settings.DATA_DIR = orig_data
    os.environ.pop("MAS_OUTPUT_DIR", None)


def wait_for_job_terminal_status(client: TestClient, job_id: str, timeout_seconds: float = 10.0) -> dict:
    """Helper to poll job until it reaches a terminal status."""
    deadline = time.time() + timeout_seconds
    while time.time() < deadline:
        res = client.get(f"/api/jobs/{job_id}")
        assert res.status_code == 200
        data = res.json()
        if data["status"] in ("succeeded", "empty", "failed", "cancelled"):
            return data
        time.sleep(0.1)
    raise TimeoutError(f"Job {job_id} did not finish within {timeout_seconds} seconds")


def test_system_health_and_options():
    with TestClient(app) as client:
        # 1. Health check
        h_res = client.get("/api/health")
        assert h_res.status_code == 200
        health = h_res.json()
        assert health["status"] == "ok"
        assert "version" in health
        assert "python" in health
        assert isinstance(health["playwright_ok"], bool)
        assert health["queue_size"] >= 0

        # 2. Options check
        o_res = client.get("/api/options")
        assert o_res.status_code == 200
        opts = o_res.json()
        assert "statuses" in opts
        assert "platforms" in opts
        assert "recipes" in opts
        assert len(opts["recipes"]) >= 4


def test_job_lifecycle_succeeded():
    with TestClient(app) as client:
        # Create job
        create_res = client.post(
            "/api/jobs",
            json={
                "mode": "keyword",
                "query": "psicologia",
                "country": "ES",
                "limit": 50,
            },
        )
        assert create_res.status_code == 201
        job_data = create_res.json()
        job_id = job_data["id"]

        # Wait for terminal status
        final_job = wait_for_job_terminal_status(client, job_id)
        assert final_job["status"] == "succeeded"
        assert final_job["phase"] == "finished"
        assert final_job["result_file"] is not None
        assert final_job["progress"]["collected"] == 2

        # Check logs endpoints
        text_logs = client.get(f"/api/jobs/{job_id}/logs?format=text")
        assert text_logs.status_code == 200
        assert "Starting scrape" in text_logs.text

        json_logs = client.get(f"/api/jobs/{job_id}/logs?format=json")
        assert json_logs.status_code == 200
        entries = json_logs.json()
        assert len(entries) > 0
        assert any("Starting scrape" in e["message"] for e in entries)


def test_job_lifecycle_empty():
    with TestClient(app) as client:
        res = client.post("/api/jobs", json={"mode": "keyword", "query": "EMPTY_TEST"})
        assert res.status_code == 201
        job_id = res.json()["id"]

        final_job = wait_for_job_terminal_status(client, job_id)
        assert final_job["status"] == "empty"
        assert final_job["phase"] == "finished"
        assert final_job["result_file"] is None


def test_job_lifecycle_failed():
    with TestClient(app) as client:
        res = client.post("/api/jobs", json={"mode": "keyword", "query": "FAIL_TEST"})
        assert res.status_code == 201
        job_id = res.json()["id"]

        final_job = wait_for_job_terminal_status(client, job_id)
        assert final_job["status"] == "failed"
        assert "Scraping crashed unexpectedly" in (final_job["error"] or "")


def test_job_lifecycle_cancellation():
    with TestClient(app) as client:
        res = client.post("/api/jobs", json={"mode": "keyword", "query": "SLOW_TEST"})
        assert res.status_code == 201
        job_id = res.json()["id"]

        # Small pause so process starts running
        time.sleep(0.15)
        cancel_res = client.post(f"/api/jobs/{job_id}/cancel")
        assert cancel_res.status_code == 200

        final_job = wait_for_job_terminal_status(client, job_id)
        assert final_job["status"] == "cancelled"

        # Cancelling an already finished job must return 409
        conflict_res = client.post(f"/api/jobs/{job_id}/cancel")
        assert conflict_res.status_code == 409
        assert conflict_res.json()["code"] == "conflict"


def test_job_retry_and_delete():
    with TestClient(app) as client:
        res = client.post("/api/jobs", json={"mode": "keyword", "query": "EMPTY_TEST"})
        job_id = res.json()["id"]
        wait_for_job_terminal_status(client, job_id)

        # Retry job
        retry_res = client.post(f"/api/jobs/{job_id}/retry")
        assert retry_res.status_code == 201
        new_job_id = retry_res.json()["id"]
        assert new_job_id != job_id
        wait_for_job_terminal_status(client, new_job_id)

        # Delete completed original job
        del_res = client.delete(f"/api/jobs/{job_id}")
        assert del_res.status_code == 204

        # Verify 404 after deletion
        get_res = client.get(f"/api/jobs/{job_id}")
        assert get_res.status_code == 404
        assert get_res.json()["code"] == "job_not_found"


def test_job_sse_events_stream():
    with TestClient(app) as client:
        res = client.post("/api/jobs", json={"mode": "keyword", "query": "sse_stream_test"})
        job_id = res.json()["id"]

        events: list[str] = []
        with client.stream("GET", f"/api/jobs/{job_id}/events") as stream:
            for line in stream.iter_lines():
                if line:
                    events.append(line)
                if "event: done" in line:
                    break

        assert any("event: snapshot" in e for e in events)
        assert any("event: log" in e for e in events)
        assert any("event: done" in e for e in events)


def test_batches_lifecycle():
    with TestClient(app) as client:
        batch_req = {
            "queries": ["batch_q1", "batch_q2"],
            "base": {
                "mode": "keyword",
                "query": "ignored",
                "limit": 20,
            },
            "pause_seconds": 0,
        }
        res = client.post("/api/batches", json=batch_req)
        assert res.status_code == 201
        batch_data = res.json()
        batch_id = batch_data["id"]
        assert batch_data["total_jobs"] == 2

        # List batches
        list_res = client.get("/api/batches")
        assert list_res.status_code == 200
        assert any(b["id"] == batch_id for b in list_res.json())

        # Detail
        detail_res = client.get(f"/api/batches/{batch_id}")
        assert detail_res.status_code == 200
        assert detail_res.json()["id"] == batch_id

        # Cancel batch
        cancel_res = client.post(f"/api/batches/{batch_id}/cancel")
        assert cancel_res.status_code == 200


def test_results_api_endpoints():
    with TestClient(app) as client:
        # Run a successful job to create a result file
        job_res = client.post("/api/jobs", json={"mode": "keyword", "query": "results_test"})
        job_id = job_res.json()["id"]
        final_job = wait_for_job_terminal_status(client, job_id)
        filename = final_job["result_file"]
        assert filename is not None

        # 1. GET /api/results
        list_res = client.get("/api/results")
        assert list_res.status_code == 200
        files = list_res.json()
        assert any(f["filename"] == filename for f in files)

        # 2. GET /api/results/{filename}
        detail_res = client.get(f"/api/results/{filename}")
        assert detail_res.status_code == 200
        detail = detail_res.json()
        assert detail["file"]["filename"] == filename
        assert len(detail["rows"]) == 2

        # 3. GET /api/results/{filename}/download
        dl_res = client.get(f"/api/results/{filename}/download")
        assert dl_res.status_code == 200
        assert "attachment" in dl_res.headers.get("content-disposition", "")
        assert len(dl_res.content) > 0

        # 4. POST /api/results/merge
        merge_res = client.post(
            "/api/results/merge",
            json={
                "filenames": [filename],
                "dedupe_by": "ad_id",
            },
        )
        assert merge_res.status_code == 200
        merge_data = merge_res.json()
        assert merge_data["total_before_dedupe"] == 2
        assert merge_data["total_after_dedupe"] == 2

        # 5. DELETE /api/results/{filename}
        del_res = client.delete(f"/api/results/{filename}")
        assert del_res.status_code == 204

        # Verify 404 after deletion
        get_res = client.get(f"/api/results/{filename}")
        assert get_res.status_code == 404
        assert get_res.json()["code"] == "not_found"


def test_error_handlers_format():
    with TestClient(app) as client:
        # 404 error
        res_404 = client.get("/api/jobs/nonexistent_id")
        assert res_404.status_code == 404
        data_404 = res_404.json()
        assert "detail" in data_404
        assert "code" in data_404
        assert data_404["code"] == "job_not_found"

        # 422 validation error
        res_422 = client.post("/api/jobs", json={"mode": "invalid_mode"})
        assert res_422.status_code == 422
        data_422 = res_422.json()
        assert "detail" in data_422
        assert data_422["code"] == "validation_error"

        # 400 path traversal on result file
        res_400 = client.get("/api/results/..%2F..%2Fsecret.csv")
        assert res_400.status_code == 400
        data_400 = res_400.json()
        assert "detail" in data_400
        assert data_400["code"] == "invalid_filename"
