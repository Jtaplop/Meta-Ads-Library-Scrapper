"""
exporters/csv_exporter.py — Write scraped ads to a CSV file using pandas.
"""

from __future__ import annotations

from pathlib import Path
from typing import List

import pandas as pd
from loguru import logger

from config import OUTPUT_DIR
from models.ad import Ad


class CsvExporter:
    """
    Serialises a list of :class:`~models.ad.Ad` instances to a UTF-8 CSV file.

    Parameters
    ----------
    output_dir:
        Directory where CSV files will be written.
        Defaults to :data:`~config.OUTPUT_DIR`.
    """

    def __init__(self, output_dir: str = OUTPUT_DIR) -> None:
        self.output_dir = Path(output_dir)

    def export(self, ads: List[Ad], filename: str) -> Path:
        """
        Serialise *ads* to a CSV file at ``output_dir / filename``.

        Creates the output directory if it does not already exist.
        List fields (e.g. ``platforms``) are flattened to comma-separated
        strings so that every cell contains a scalar value.
        ``None`` values are written as empty strings.

        Parameters
        ----------
        ads:
            List of validated :class:`~models.ad.Ad` instances to export.
        filename:
            Target file name, including the ``.csv`` extension.

        Returns
        -------
        Path
            Absolute :class:`~pathlib.Path` of the written CSV file.
        """
        self.output_dir.mkdir(parents=True, exist_ok=True)
        dest = self.output_dir / filename

        if not ads:
            logger.warning("CsvExporter: ads list is empty — writing header-only CSV")
            # Build an empty DataFrame with the correct column order
            columns = list(Ad.model_fields.keys())
            df = pd.DataFrame(columns=columns)
        else:
            records = [ad.model_dump() for ad in ads]
            for record in records:
                # Flatten list fields to a comma-separated string
                if isinstance(record.get("platforms"), list):
                    record["platforms"] = ", ".join(record["platforms"])
                # Replace None with empty string for clean CSV output
                for key, value in record.items():
                    if value is None:
                        record[key] = ""
            df = pd.DataFrame(records)

        df.to_csv(dest, index=False, encoding="utf-8-sig")
        logger.info("CSV exported → {} ({} ads)", dest.resolve(), len(ads))
        return dest.resolve()
