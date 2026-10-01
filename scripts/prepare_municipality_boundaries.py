"""Dissolve and simplify MLIT's 2025 small-area polygons by municipality."""

import sys
from pathlib import Path

import geopandas as gpd

from census_2025 import BOUNDARY_SIMPLIFICATION_TOLERANCE


def main() -> None:
    script_dir = Path(__file__).resolve().parent
    data_dir = script_dir.parent / "data"
    source_path = data_dir / "geojson-s0001" / "N03-20250101.geojson"
    output_path = data_dir / "geojson-s0001" / "N03-25_250101.json"

    if not source_path.exists():
        print(f"Official boundary source not found: {source_path}")
        print("Run download_census_2025.py --with-boundaries first.")
        sys.exit(1)

    print(f"Reading official 2025 boundaries: {source_path}")
    gdf = gpd.read_file(source_path)
    required = [f"N03_{index:03}" for index in range(1, 6)] + ["N03_007"]
    missing = [column for column in required if column not in gdf.columns]
    if missing:
        raise ValueError(f"Expected N03 fields are missing: {missing}")

    gdf = gdf[required + ["geometry"]].copy()
    gdf = gdf[gdf["N03_007"].notna()].copy()
    gdf["N03_007"] = gdf["N03_007"].astype(str).str.strip().str.zfill(5)
    print(f"Dissolving {len(gdf):,} small-area polygons by municipality code...")
    municipalities = gdf.dissolve(by="N03_007", as_index=False, aggfunc="first")

    # Keep the nationwide GeoJSON practical to serve. Isolated tiny components
    # can disappear at this scale, so retain the original geometry for any shape
    # that would otherwise become empty.
    tolerance = BOUNDARY_SIMPLIFICATION_TOLERANCE
    print(f"Simplifying {len(municipalities):,} municipality geometries...")
    simplified = municipalities.geometry.simplify(
        tolerance=tolerance, preserve_topology=False
    )
    empty_geometries = simplified.is_empty
    if empty_geometries.any():
        print(f"Retaining original geometry for {empty_geometries.sum()} tiny areas")
        simplified.loc[empty_geometries] = municipalities.loc[empty_geometries, "geometry"]
    if (~simplified.is_valid).any():
        raise ValueError("Simplification produced invalid municipality geometries")
    municipalities["geometry"] = simplified
    if municipalities["N03_007"].duplicated().any():
        raise ValueError("Dissolve did not produce unique municipality codes")

    required_hamamatsu_codes = {"22138", "22139", "22140"}
    actual_codes = set(municipalities["N03_007"])
    if not required_hamamatsu_codes.issubset(actual_codes):
        raise ValueError("The 2025 boundary is missing one or more Hamamatsu ward codes")

    output_path.parent.mkdir(parents=True, exist_ok=True)
    municipalities.to_file(output_path, driver="GeoJSON", index=False)
    print(
        f"Saved {len(municipalities):,} municipality/area shapes to {output_path} "
        f"({output_path.stat().st_size / (1024 * 1024):.1f} MiB)"
    )


if __name__ == "__main__":
    main()
