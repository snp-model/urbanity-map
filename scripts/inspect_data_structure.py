
import pandas as pd
import os

files = {
    'census_2020_excel': 'data/b01_01.xlsx',
    'census_2015_csv': 'data/00320_00.csv',
    'tax_csv': 'data/J51-24-b(令和6年度_第11表市町村別データ).csv',
}

def inspect_file(name, path):
    print(f"\n--- Inspecting {name} ({path}) ---")
    if not os.path.exists(path):
        print(f"File not found: {path}")
        return

    try:
        if path.endswith('.xlsx'):
            # Read first few rows to detect header
            df = pd.read_excel(path, nrows=10)
        else:
            # Try reading with typical encodings
            try:
                df = pd.read_csv(path, nrows=10, encoding='cp932')
            except:
                df = pd.read_csv(path, nrows=10, encoding='utf-8')
        
        print("Columns:", df.columns.tolist())
        print("Head:")
        print(df.head())
        # Print first valid row to see data types
        print("First valid row sample:")
        print(df.iloc[-1].to_dict())

    except Exception as e:
        print(f"Error reading file: {e}")

for name, path in files.items():
    inspect_file(name, path)
