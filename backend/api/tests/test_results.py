"""
test_results.py — Unit tests for ResultsService: path traversal security, CSV BOM reading,
JSON loading, row count caching, listing, deletion, and deduplicated merging.
"""

from __future__ import annotations

import csv
import json
from datetime import datetime
from pathlib import Path

import pytest

from api.results import ResultsService
from api.schemas import AdRecord


@pytest.fixture
def results_svc(tmp_path: Path) -> ResultsService:
    output_dir = tmp_path / "output"
    output_dir.mkdir(parents=True, exist_ok=True)
    return ResultsService(output_dir=output_dir)


def test_filename_validation_security(results_svc: ResultsService):
    # Path traversal attempts
    with pytest.raises(ValueError, match="Path traversal"):
        results_svc.validate_filename("../secret.csv")

    with pytest.raises(ValueError, match="Path traversal"):
        results_svc.validate_filename("subdir/test.csv")

    with pytest.raises(ValueError, match="Path traversal"):
        results_svc.validate_filename("..\\secret.csv")

    with pytest.raises(ValueError, match="Path traversal"):
        results_svc.validate_filename("nested\\test.csv")

    # Unsupported file extensions
    with pytest.raises(ValueError, match="Unsupported file format"):
        results_svc.validate_filename("payload.exe")

    with pytest.raises(ValueError, match="Unsupported file format"):
        results_svc.validate_filename("script.py")

    # Empty filename
    with pytest.raises(ValueError):
        results_svc.validate_filename("")

    # Valid filenames
    valid_csv = results_svc.validate_filename("anuncios_20261109_120000.csv")
    assert valid_csv == results_svc.output_dir / "anuncios_20261109_120000.csv"

    valid_json = results_svc.validate_filename("anuncios_ig_profiles_20261109_120000.json")
    assert valid_json == results_svc.output_dir / "anuncios_ig_profiles_20261109_120000.json"


def test_csv_reading_with_bom_and_normalization(results_svc: ResultsService):
    filename = "test_ads_20261109_153000.csv"
    path = results_svc.output_dir / filename

    # Write CSV with UTF-8 BOM
    with open(path, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.writer(f)
        writer.writerow([
            "ad_id",
            "page_id",
            "page_name",
            "ad_text",
            "ad_caption",
            "start_date",
            "end_date",
            "status",
            "image_url",
            "video_url",
            "landing_page",
            "ig_username",
            "platforms",
            "snapshot_url",
        ])
        writer.writerow([
            "9876543210123456",  # Large numeric ID as string
            "12345678",
            "Nike Running",
            "Just do it",
            "",  # empty string -> None
            "2024-03-01",
            "",
            "ACTIVE",
            "https://example.com/img.jpg",
            "",
            "https://example.com",
            "nikerunning",
            "FACEBOOK, INSTAGRAM",
            "https://example.com/snap",
        ])

    detail = results_svc.get_result(filename)
    assert detail.file.filename == filename
    assert detail.file.label == "test_ads"
    assert detail.file.ig_profiles_only is False
    assert detail.file.format == "csv"
    assert detail.file.created_at == datetime(2026, 11, 9, 15, 30, 0)
    assert len(detail.rows) == 1

    row = detail.rows[0]
    assert row.ad_id == "9876543210123456"
    assert row.page_id == "12345678"
    assert row.ad_caption is None
    assert row.status == "ACTIVE"
    assert row.platforms == ["FACEBOOK", "INSTAGRAM"]
    assert row.ig_username == "nikerunning"


def test_json_reading_and_normalization(results_svc: ResultsService):
    filename = "psicologia_ig_profiles_20261109_180000.json"
    path = results_svc.output_dir / filename

    data = [
        {
            "ad_id": 1234567890123,  # Integer ID in JSON -> normalized to str
            "page_id": 999999,
            "page_name": "Terapia Madrid",
            "ad_text": "Terapia online para ansiedad",
            "ad_caption": None,
            "start_date": "2024-02-10",
            "end_date": None,
            "status": "active",
            "image_url": None,
            "video_url": "https://example.com/video.mp4",
            "landing_page": "https://terapia.es",
            "ig_username": "terapiamadrid",
            "platforms": ["INSTAGRAM"],
            "snapshot_url": "https://example.com/snap",
        }
    ]

    with open(path, "w", encoding="utf-8") as f:
        json.dump(data, f, indent=2)

    detail = results_svc.get_result(filename)
    assert detail.file.label == "psicologia"
    assert detail.file.ig_profiles_only is True
    assert detail.file.format == "json"
    assert len(detail.rows) == 1

    row = detail.rows[0]
    assert row.ad_id == "1234567890123"
    assert row.page_id == "999999"
    assert row.status == "ACTIVE"
    assert row.platforms == ["INSTAGRAM"]


def test_row_counting_caching(results_svc: ResultsService):
    filename = "cached_test_20261109_120000.csv"
    path = results_svc.output_dir / filename

    with open(path, "w", encoding="utf-8-sig", newline="") as f:
        f.write("ad_id,page_id\n")
        f.write("1,10\n")
        f.write("2,20\n")
        f.write("3,30\n")

    count1 = results_svc.count_rows(path)
    assert count1 == 3
    stat1 = path.stat()
    assert (str(path.resolve()), stat1.st_mtime_ns, stat1.st_size) in results_svc._row_cache

    # Subsequent count hits cache
    count2 = results_svc.count_rows(path)
    assert count2 == 3


def test_list_results_filtering_and_sorting(results_svc: ResultsService):
    f1 = results_svc.output_dir / "psicologia_20261109_100000.csv"
    f2 = results_svc.output_dir / "psicologia_ig_profiles_20261109_120000.csv"
    f3 = results_svc.output_dir / "dentistas_20261109_150000.json"

    for f in (f1, f2, f3):
        f.write_text("ad_id\n1\n", encoding="utf-8")

    # Test all results sorted desc by created_at
    all_res = results_svc.list_results()
    assert len(all_res) == 3
    assert all_res[0].filename == "dentistas_20261109_150000.json"
    assert all_res[1].filename == "psicologia_ig_profiles_20261109_120000.csv"
    assert all_res[2].filename == "psicologia_20261109_100000.csv"

    # Filter by query q
    res_q = results_svc.list_results(q="psico")
    assert len(res_q) == 2
    assert all("psicologia" in r.filename for r in res_q)

    # Filter by format
    res_json = results_svc.list_results(fmt="json")
    assert len(res_json) == 1
    assert res_json[0].filename == "dentistas_20261109_150000.json"

    # Filter by ig_only
    res_ig = results_svc.list_results(ig_only=True)
    assert len(res_ig) == 1
    assert res_ig[0].filename == "psicologia_ig_profiles_20261109_120000.csv"


def test_merge_results_deduplication(results_svc: ResultsService):
    fn1 = "campana1_20261109_100000.csv"
    fn2 = "campana2_20261109_120000.csv"

    # File 1 has ad 100 with start_date 2024-03-01 and ad 200
    p1 = results_svc.output_dir / fn1
    with open(p1, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(["ad_id", "start_date", "ig_username"])
        w.writerow(["100", "2024-03-01", "brand_a"])
        w.writerow(["200", "2024-04-01", "brand_b"])

    # File 2 has ad 100 with EARLIER start_date 2024-01-15, and ad 300
    p2 = results_svc.output_dir / fn2
    with open(p2, "w", encoding="utf-8-sig", newline="") as f:
        w = csv.writer(f)
        w.writerow(["ad_id", "start_date", "ig_username"])
        w.writerow(["100", "2024-01-15", "brand_a_updated"])
        w.writerow(["300", "2024-05-01", "brand_c"])

    # Merge by ad_id
    merged = results_svc.merge_results([fn1, fn2], dedupe_by="ad_id")
    assert merged.total_before_dedupe == 4
    assert merged.total_after_dedupe == 3

    # Check that ad 100 preserved the earlier start date (2024-01-15)
    ad_100 = next(r for r in merged.rows if r.ad_id == "100")
    assert ad_100.start_date == "2024-01-15"
    assert ad_100.ig_username == "brand_a_updated"


def test_delete_result(results_svc: ResultsService):
    fn = "to_delete_20261109_120000.csv"
    p = results_svc.output_dir / fn
    p.write_text("ad_id\n1\n", encoding="utf-8")

    assert p.exists()
    results_svc.delete_result(fn)
    assert not p.exists()

    with pytest.raises(FileNotFoundError):
        results_svc.delete_result(fn)
