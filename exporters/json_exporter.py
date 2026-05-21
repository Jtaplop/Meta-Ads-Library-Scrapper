"""
exporters/json_exporter.py — Write scraped ads to a JSON file using the stdlib json module.
"""

from __future__ import annotations

import json
from datetime import date
from pathlib import Path
from typing import Any, List

from loguru import logger

from config import OUTPUT_DIR
from models.ad import Ad


def _default_serializer(obj: Any) -> Any:
    """
    Custom JSON serializer for types that :mod:`json` cannot handle natively.

    Currently handles:

    * :class:`datetime.date` → ISO-8601 string (``"YYYY-MM-DD"``).

    Parameters
    ----------
    obj:
        Object that the standard encoder could not serialise.

    Returns
    -------
    Any
        A JSON-serialisable representation of *obj*.

    Raises
    ------
    TypeError
        When *obj* is of an unrecognised type.
    """
    if isinstance(obj, date):
        return obj.isoformat()
    raise TypeError(f"Object of type {type(obj).__name__} is not JSON serialisable")


class JsonExporter:
    """
    Serialises a list of :class:`~models.ad.Ad` instances to a JSON file.

    Parameters
    ----------
    output_dir:
        Directory where JSON files will be written.
        Defaults to :data:`~config.OUTPUT_DIR`.
    indent:
        Number of spaces used for JSON indentation (default ``2``).
    """

    def __init__(self, output_dir: str = OUTPUT_DIR, indent: int = 2) -> None:
        self.output_dir = Path(output_dir)
        self.indent = indent

    def export(self, ads: List[Ad], filename: str) -> Path:
        """
        Serialise *ads* to a JSON file at ``output_dir / filename``.

        Creates the output directory if it does not already exist.
        The JSON file contains a top-level array where each element is a
        flat object matching the :class:`~models.ad.Ad` field schema.

        Parameters
        ----------
        ads:
            List of validated :class:`~models.ad.Ad` instances to export.
        filename:
            Target file name, including the ``.json`` extension.

        Returns
        -------
        Path
            Absolute :class:`~pathlib.Path` of the written JSON file.
        """
        self.output_dir.mkdir(parents=True, exist_ok=True)
        dest = self.output_dir / filename

        records = [ad.model_dump() for ad in ads]

        with open(dest, "w", encoding="utf-8") as fh:
            json.dump(
                records,
                fh,
                indent=self.indent,
                default=_default_serializer,
                ensure_ascii=False,
            )

        logger.info("JSON exported → {} ({} ads)", dest.resolve(), len(ads))
        return dest.resolve()
