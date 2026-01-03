
import pandas as pd
import json
import os
from pathlib import Path

def main():
    script_dir = Path(__file__).parent
    data_dir = script_dir.parent / "data"
    output_dir = script_dir.parent / "frontend" / "public" / "data"
    output_dir.mkdir(parents=True, exist_ok=True)

    input_csv = data_dir / "J51-24-b(令和6年度_第11表市町村別データ).csv"
    output_json = output_dir / "tax_income.json"

    print(f"Reading Tax CSV: {input_csv}")
    
    # Read CSV, assuming header is at row 0 (which contains "第11表...")
    # But actual data starts around row 3 based on inspection.
    # The columns we saw in inspection:
    # Unnamed: 1 -> Code
    # Unnamed: 5 -> Taxpayers (e.g. "131,905")
    # Unnamed: 6 -> Taxable Income (e.g. "420,008,387" in thousands) -> Unit is "千円" based on typical MIC stats?
    # Let's verify unit. Usually these tables are in "Thousand Yen".
    # Inspection output said: Row 2 col 15 is "千円". So yes.
    
    try:
        df = pd.read_csv(input_csv, header=None, skiprows=3)
    except:
        df = pd.read_csv(input_csv, header=None, skiprows=3, encoding='cp932')
    
    # Select columns
    # Col 1 (index 1): Code
    # Col 5 (index 5): Taxpayers (所得割納税義務者数)
    # Col 6 (index 6): Taxable Income (課税対象所得)
    
    # Debug: Print first few rows
    print("Debug: First 5 rows of DataFrame:")
    print(df.head())
    
    result = {}
    
    for i, row in df.iterrows():
        try:
            # Column 1: Code
            code_val = row[1]
            if pd.isna(code_val):
                continue
            
            # Handle float (e.g. 1000.0) -> int -> str
            try:
                code_float = float(code_val)
                code = str(int(code_float))
            except:
                code = str(code_val).strip()
            
            # Skip if not digit (e.g. header leftovers)
            if not code.isdigit():
                continue
            
            # Pad with leading zero if 5 digits (standard is 5 digits)
            # But here standard code is 6 digits with check digit?
            # e.g. 011002 ->北海道札幌市
            # If read as float 11002.0 -> "11002" (missing leading zero)
            if len(code) == 5:
                code = "0" + code
            
            # Now we likely have 6 digits (e.g. 011002).
            # We want 5 digits (01100).
            if len(code) == 6:
                code = code[:5]

            # Column 5: Taxpayers
            taxpayers_val = row[5]
            # Column 6: Taxable Income
            income_val = row[6]
            
            if pd.isna(taxpayers_val) or pd.isna(income_val):
                continue

            # Clean numeric strings
            taxpayers_str = str(taxpayers_val).replace(',', '').strip()
            income_str = str(income_val).replace(',', '').strip()
            
            # Handle cases like "-" or "*"
            if not taxpayers_str.replace('.', '', 1).isdigit():
                continue
            if not income_str.replace('.', '', 1).isdigit():
                continue
                
            taxpayers = float(taxpayers_str)
            income_thousand_yen = float(income_str)
            
            if taxpayers <= 0:
                continue
            
            # Avg Income per Taxpayer (Yen) = (Total Income in 1000s * 1000) / Taxpayers
            avg_income = (income_thousand_yen * 1000) / taxpayers
            
            # Normalize code to 5 digits
            if len(code) == 6: # e.g. 012041 -> 01204
                 code = code[:5]
            
            result[code] = round(avg_income)
            
        except Exception as e:
            if i < 10:
                print(f"Error processing row {i}: {e}")
            continue
    
    # Post-processing: Fill missing ward data using city-level data
    # Designated cities often provide data at the city level (ending in '0') 
    # but the map uses ward codes (ending in '1'-'9').
    
    # Get all keys that look like city parents (ending in '0')
    parent_codes = {k for k in result.keys() if k.endswith('0')}
    
    # We need to know which codes are required by the map to fill them in.
    # Load GeoJSON to get target codes
    geojson_path = output_dir / "japan-with-scores-v2.geojson"
    if geojson_path.exists():
        print(f"Loading GeoJSON from {geojson_path} to identify missing wards...")
        with open(geojson_path, 'r') as f:
            geojson = json.load(f)
            
        filled_count = 0
        for feature in geojson['features']:
            props = feature['properties']
            code = props.get('N03_007')
            
            if not code:
                continue
                
            # If code is already in result, skip
            if code in result:
                continue
                
            # Try to find a parent code
            # Heuristic 1: Replace last digit with '0'
            # e.g. 01101 (Sapporo Chuo-ku) -> 01100 (Sapporo City)
            parent_candidate = code[:-1] + '0'
            
            if parent_candidate in result:
                result[code] = result[parent_candidate]
                filled_count += 1
                continue
                
            # Heuristic 2: Replace last 2 digits with '00'
            # e.g. 01110 (Sapporo Kiyota-ku) -> 01100 (Sapporo City)
            # e.g. 14110 (Yokohama Totsuka-ku) -> 14100 (Yokohama City)
            parent_candidate_2 = code[:-2] + '00'
            
            if parent_candidate_2 in result:
                result[code] = result[parent_candidate_2]
                filled_count += 1
                continue
                
        print(f"Filled {filled_count} missing wards using city-level data.")
    else:
        print("Warning: GeoJSON not found. Skipping ward filling.")
            
    print(f"Processed {len(result)} municipalities (including filled wards).")
    
    with open(output_json, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
        
    print(f"Saved to {output_json}")

if __name__ == "__main__":
    main()
