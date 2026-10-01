"""Generate 2025 population growth and elderly-share data from e-Stat tables."""

import json
from pathlib import Path

import pandas as pd

from census_2025 import (
    column_for_header,
    column_for_metadata,
    load_boundary_codes,
    load_census_table,
    selected_current_rows,
)


def load_elderly_ratio(data_dir: Path, boundary_codes: set[str]) -> dict[str, float]:
    """Read table 2-7's official 65-and-over subtotal and divide by total population."""
    path = data_dir / "census_2025" / "census2025_table_2-7.xlsx"
    table, header_row = load_census_table(path, "b02_07")

    nationality_col = column_for_header(table, header_row, "国籍総数か日本人")
    gender_col = column_for_header(table, header_row, "男女")
    region_col = column_for_header(table, header_row, "地域識別コード")
    municipality_col = column_for_header(table, header_row, "2025年_地域コード")
    total_col = column_for_metadata(table, header_row, "00_総数")
    elderly_col = column_for_metadata(table, header_row, "R3_（再掲）65歳以上")

    rows = selected_current_rows(
        table,
        header_row,
        region_col,
        municipality_col,
        boundary_codes,
        require_unique=False,
    )
    rows = rows[
        rows[nationality_col].astype(str).str.strip().eq("0_国籍総数")
        & rows[gender_col].astype(str).str.strip().eq("0_総数")
    ].copy()
    if rows["_municipality_code"].duplicated().any():
        raise ValueError("Duplicate total-gender rows in table 2-7")
    rows["_total"] = pd.to_numeric(rows[total_col], errors="coerce")
    rows["_elderly"] = pd.to_numeric(rows[elderly_col], errors="coerce")
    rows = rows.dropna(subset=["_total", "_elderly"])
    rows = rows[rows["_total"] > 0]

    result = {
        row["_municipality_code"]: round(row["_elderly"] / row["_total"] * 100, 2)
        for _, row in rows.iterrows()
    }
    print(f"65歳以上割合: {len(result):,} 件")
    return result


def main() -> None:
    script_dir = Path(__file__).resolve().parent
    data_dir = script_dir.parent / "data"
    output_dir = script_dir.parent / "frontend" / "public" / "data"
    output_dir.mkdir(parents=True, exist_ok=True)

    boundary_codes = load_boundary_codes(data_dir)
    elderly_ratios = load_elderly_ratio(data_dir, boundary_codes)

    path = data_dir / "census_2025" / "census2025_table_1-1.xlsx"
    table, header_row = load_census_table(path, "b01_01")
    region_col = column_for_header(table, header_row, "地域識別コード")
    municipality_col = column_for_header(table, header_row, "2025年_地域コード")
    growth_col = column_for_metadata(table, header_row, "5年間の人口増減率", offset=5)
    rows = selected_current_rows(
        table, header_row, region_col, municipality_col, boundary_codes
    )

    result: dict[str, dict[str, float | None]] = {}
    for _, row in rows.iterrows():
        code = row["_municipality_code"]
        growth = pd.to_numeric(row[growth_col], errors="coerce")
        result[code] = {
            "pop_growth": round(float(growth), 2) if pd.notna(growth) else None,
            "elderly_ratio": elderly_ratios.get(code),
        }

    output_path = output_dir / "demographics.json"
    output_path.write_text(
        json.dumps(result, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
    )
    print(f"人口増減率: {sum(v['pop_growth'] is not None for v in result.values()):,} 件")
    print(f"統計対象地域: {len(result):,} 件 / 境界形状: {len(boundary_codes):,} 件")
    print(f"Saved to {output_path}")


if __name__ == "__main__":
    main()
