
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
            
    print(f"Processed {len(result)} municipalities.")
    
    with open(output_json, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
        
    print(f"Saved to {output_json}")

if __name__ == "__main__":
    main()
