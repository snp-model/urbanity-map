
import geopandas as gpd
import pandas as pd
import json
import sys
from pathlib import Path

def main():
    script_dir = Path(__file__).parent
    data_dir = script_dir.parent / "data"
    output_dir = script_dir.parent / "frontend" / "public" / "data"
    output_dir.mkdir(parents=True, exist_ok=True)

    land_price_path = data_dir / "L01-25.geojson"
    municipalities_path = data_dir / "geojson-s0001" / "N03-21_210101.json"
    output_path = output_dir / "land_price.json"

    if not land_price_path.exists():
        print(f"Error: Land Price file not found: {land_price_path}")
        return

    print("Reading Land Price GeoJSON...")
    # L01-25.geojson has points. 'L01_008' is Price (Yen/m2?) or just Yen.
    # From ogrinfo output earlier: "L01_008": 445000 (integer).
    # "L01_062" to "L01_104" seem to be historical prices?
    # We will use L01_008 (Current Year Price).
    land_gdf = gpd.read_file(land_price_path)
    
    print("Reading Municipalities GeoJSON...")
    muni_gdf = gpd.read_file(municipalities_path)

    # Ensure CRS content
    # L01 is EPSG:6668 (JGD2011)
    # Muni is likely 4326 or 6668
    if land_gdf.crs != muni_gdf.crs:
        print(f"Aligning CRS: Land({land_gdf.crs}) -> Muni({muni_gdf.crs})")
        land_gdf = land_gdf.to_crs(muni_gdf.crs)

    print("Spatial Join...")
    # Join points to polygons
    joined = gpd.sjoin(land_gdf, muni_gdf, how="inner", predicate="within")

    # Find stats
    # Muni Code column: Usually 'N03_007' in N03 series.
    code_col = 'N03_007'
    if code_col not in joined.columns:
        # Fallback
        for col in ['code', 'id', 'JCODE']:
            if col in joined.columns:
                code_col = col
                break
    
    if code_col not in joined.columns:
        print("Error: Could not find municipality code column.")
        return

    print("Calculating Average Price...")
    # Group by code and mean of L01_008
    # L01_008 might be string in some datasets, but typically int in GeoJSON if properly typed.
    # Check type
    joined['price'] = pd.to_numeric(joined['L01_008'], errors='coerce')
    
    stats = joined.groupby(code_col)['price'].mean().reset_index()
    
    result = {}
    for _, row in stats.iterrows():
        code = str(row[code_col])
        avg_price = row['price']
        if pd.isna(avg_price):
            continue
        result[code] = round(avg_price)

    print(f"Processed {len(result)} municipalities.")
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    
    print(f"Saved to {output_path}")

if __name__ == "__main__":
    main()
