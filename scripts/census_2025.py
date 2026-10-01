"""Shared readers for the 2025 Population Basic Tabulation workbooks."""

import json
import re
from pathlib import Path
from typing import Any

import pandas as pd


CURRENT_REGION_IDENTIFIERS = {"0", "1", "2", "3"}
BOUNDARY_PATH_PARTS = ("geojson-s0001", "N03-25_250101.json")
BOUNDARY_SIMPLIFICATION_TOLERANCE = 0.002  # approximately 200 m in Japan


def normalize_code(value: Any) -> str | None:
    """Normalize Excel/GeoJSON municipality codes to five-character strings."""
    if pd.isna(value):
        return None

    code = str(value).strip()
    if re.fullmatch(r"\d+\.0+", code):
        code = code.split(".", 1)[0]
    if not code.isdigit() or len(code) > 5:
        return None
    return code.zfill(5)


def normalize_identifier(value: Any) -> str | None:
    if pd.isna(value):
        return None
    identifier = str(value).strip()
    if re.fullmatch(r"\d+\.0+", identifier):
        identifier = identifier.split(".", 1)[0]
    return identifier or None


def load_boundary_codes(data_dir: Path) -> set[str]:
    """Read the prepared boundary's codes without loading geometries."""
    path = data_dir.joinpath(*BOUNDARY_PATH_PARTS)
    if not path.exists():
        raise FileNotFoundError(
            f"2025 municipality boundaries not found: {path}. "
            "Run prepare_municipality_boundaries.py first."
        )

    with path.open(encoding="utf-8") as source:
        geojson = json.load(source)
    codes = {
        code
        for feature in geojson.get("features", [])
        if (code := normalize_code(feature.get("properties", {}).get("N03_007")))
    }
    if not codes:
        raise ValueError(f"No municipality codes found in {path}")
    return codes


def load_census_table(path: Path, sheet_name: str) -> tuple[pd.DataFrame, int]:
    """Load a workbook sheet and find the header row by its semantic label."""
    if not path.exists():
        raise FileNotFoundError(f"Census workbook not found: {path}")
    table = pd.read_excel(path, sheet_name=sheet_name, header=None)
    for row_index in range(min(30, len(table))):
        labels = {str(value).strip() for value in table.iloc[row_index].dropna()}
        if "地域識別コード" in labels and "2025年_地域コード" in labels:
            return table, row_index
    raise ValueError(f"Could not locate 2025 region-code headers in {path} ({sheet_name})")


def column_for_header(table: pd.DataFrame, header_row: int, label: str) -> int:
    matches = [
        index
        for index, value in table.iloc[header_row].items()
        if str(value).strip() == label
    ]
    if len(matches) != 1:
        raise ValueError(f"Expected one {label!r} column, found {len(matches)}")
    return matches[0]


def metadata_row(table: pd.DataFrame, header_row: int, offset: int) -> pd.Series:
    index = header_row - offset
    if index < 0:
        raise ValueError("Census workbook metadata rows are missing")
    return table.iloc[index]


def column_for_metadata(
    table: pd.DataFrame,
    header_row: int,
    label: str,
    *,
    offset: int = 3,
    context: tuple[tuple[int, str], ...] = (),
) -> int:
    """Find a measure column by its visible label and optional metadata context.

    ``offset`` is relative to the header row (the table label row is three rows
    above it in both 2025 workbooks). Context pairs use the same relative-row
    convention and disambiguate repeated labels such as ``0_総数``.
    """
    labels = metadata_row(table, header_row, offset)
    candidates = [index for index, value in labels.items() if str(value).strip() == label]
    for relative_row, expected in context:
        row = metadata_row(table, header_row, relative_row)
        candidates = [index for index in candidates if str(row.iloc[index]).strip() == expected]
    if len(candidates) != 1:
        raise ValueError(f"Expected one metadata column {label!r}, found {len(candidates)}")
    return candidates[0]


def selected_current_rows(
    table: pd.DataFrame,
    header_row: int,
    region_identifier_col: int,
    code_col: int,
    boundary_codes: set[str],
    *,
    require_unique: bool = True,
) -> pd.DataFrame:
    rows = table.iloc[header_row + 1 :].copy()
    rows["_region_identifier"] = rows[region_identifier_col].map(normalize_identifier)
    rows["_municipality_code"] = rows[code_col].map(normalize_code)
    rows = rows[
        rows["_region_identifier"].isin(CURRENT_REGION_IDENTIFIERS)
        & rows["_municipality_code"].isin(boundary_codes)
    ]
    if require_unique and rows["_municipality_code"].duplicated().any():
        duplicates = rows.loc[
            rows["_municipality_code"].duplicated(keep=False), "_municipality_code"
        ].unique()
        raise ValueError(f"Duplicate current municipality rows: {list(duplicates[:10])}")
    return rows
