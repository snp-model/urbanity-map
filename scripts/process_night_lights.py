"""
Night Light Data Processing Script

This script extracts mean night light radiance values for each municipality
from VIIRS Night Light GeoTIFF data and outputs a JSON file for frontend use.

Usage:
    cd scripts
    uv run process_night_lights.py

Required data files (must be downloaded manually):
    - ../data/night_lights.tif (VIIRS Annual Composite GeoTIFF for Japan)
    - ../data/japan.topojson (Municipality boundaries from SmartNews/japan-topography)

Output:
    - ../frontend/public/data/urbanity-score.json
"""

import json
import sys
from pathlib import Path

import geopandas as gpd
import numpy as np
from rasterstats import zonal_stats


def main():
    # Paths
    script_dir = Path(__file__).parent
    data_dir = script_dir.parent / "data"
    output_dir = script_dir.parent / "frontend" / "public" / "data"
    
    night_light_path = data_dir / "night_lights.tif"
    # Use GeoJSON from SmartNews/japan-topography (s0010 = 1% simplification)
    municipalities_path = data_dir / "geojson-s0010" / "N03-21_210101.json"
    output_path = output_dir / "urbanity-score.json"
    
    # Check if data files exist
    if not night_light_path.exists():
        print(f"ERROR: Night light data not found at {night_light_path}")
        print("Please download from yo5uke.com and place the GeoTIFF file there.")
        sys.exit(1)
    
    if not municipalities_path.exists():
        print(f"ERROR: Municipality boundaries not found at {municipalities_path}")
        print("Please download from SmartNews/japan-topography GitHub repo into data/s0010/")
        sys.exit(1)
    
    # Create output directory if not exists
    output_dir.mkdir(parents=True, exist_ok=True)
    
    print("Loading municipality boundaries...")
    gdf = gpd.read_file(municipalities_path)
    
    # Identify the municipality code column
    # SmartNews/japan-topography uses 'N03_007' or 'code' or 'id'
    code_col = None
    for col in ['N03_007', 'code', 'id', 'JCODE']:
        if col in gdf.columns:
            code_col = col
            break
    
    if code_col is None:
        print(f"ERROR: Could not find municipality code column. Available: {gdf.columns.tolist()}")
        sys.exit(1)
    
    print(f"Using '{code_col}' as municipality code column")
    print(f"Loaded {len(gdf)} municipalities")
    
    print("Calculating zonal statistics for night light data...")
    stats = zonal_stats(
        gdf,
        str(night_light_path),
        stats=['mean'],
        nodata=-999
    )
    
    # Extract mean values
    means = [s['mean'] if s['mean'] is not None else 0 for s in stats]
    
    # Normalize to 0-100 scale using log transformation for better visualization
    # Night light values can vary by orders of magnitude
    means_array = np.array(means)
    means_array = np.where(means_array > 0, means_array, 0.001)  # Avoid log(0)
    log_means = np.log10(means_array + 1)
    
    # Min-max normalization to 0-100
    min_val = log_means.min()
    max_val = log_means.max()
    
    if max_val > min_val:
        normalized = ((log_means - min_val) / (max_val - min_val) * 100).round(1)
    else:
        normalized = np.zeros_like(log_means)
    
    # Add score to each feature in GeoDataFrame
    gdf['score'] = normalized
    
    # Also create a lookup dictionary for reference
    result = {}
    for idx, row in gdf.iterrows():
        code = str(row[code_col])
        if len(code) < 5:
            code = code.zfill(5)
        result[code] = float(normalized[idx])
    
    # Save score lookup JSON (for reference)
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    
    # Save GeoJSON with embedded scores for MapLibre
    geojson_output_path = output_dir / "japan-with-scores.geojson"
    gdf.to_file(geojson_output_path, driver='GeoJSON')
    
    print(f"Successfully saved urbanity scores to {output_path}")
    print(f"Successfully saved GeoJSON with scores to {geojson_output_path}")
    print(f"Score range: {normalized.min():.1f} - {normalized.max():.1f}")
    print(f"Total municipalities: {len(result)}")


if __name__ == "__main__":
    main()
