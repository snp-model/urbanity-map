
import pandas as pd
import json
from pathlib import Path

def load_elderly_ratio(data_dir: Path) -> dict[str, float]:
    """b03_03.xlsx から高齢者割合を計算する
    
    65歳以上人口 / 総人口 * 100
    年齢階級 14～21 (65～69歳, 70～74歳, ..., 100歳以上) を使用
    """
    path = data_dir / "b03_03.xlsx"
    if not path.exists():
        print(f"Warning: {path} not found. Elderly ratio will be null.")
        return {}
    
    print(f"Reading age data: {path}")
    df = pd.read_excel(path, header=None, skiprows=10)
    
    # Column mapping (from file inspection):
    # Col 2: 地域コード (e.g. "01101_札幌市中央区")
    # Col 3: 国籍 (0_国籍総数 を使用)
    # Col 4: 男女 (0_総数 を使用)
    # Col 5: 年齢階級 (00_総数, 14_65～69歳, etc.)
    # Col 6: 人口
    
    # Filter: 国籍総数、男女総数のみ
    df = df[df[3] == '0_国籍総数']
    df = df[df[4] == '0_総数']
    
    # 市区町村別に集計
    result = {}
    
    # グループ化のため、コードを抽出
    def extract_code(region_str):
        if pd.isna(region_str) or '_' not in str(region_str):
            return None
        return str(region_str).split('_')[0]
    
    df['code'] = df[2].apply(extract_code)
    df = df[df['code'].notna()]
    
    # 各市区町村について計算
    for code in df['code'].unique():
        code_data = df[df['code'] == code]
        
        # 総人口 (年齢階級 "00_総数")
        total_row = code_data[code_data[5] == '00_総数']
        if total_row.empty:
            continue
        total_pop = pd.to_numeric(total_row.iloc[0][6], errors='coerce')
        if pd.isna(total_pop) or total_pop == 0:
            continue
        
        # 65歳以上人口 (年齢階級 14～21)
        elderly_ages = ['14_65～69歳', '15_70～74歳', '16_75～79歳', '17_80～84歳',
                       '18_85～89歳', '19_90～94歳', '20_95～99歳', '21_100歳以上']
        elderly_pop = 0
        for age in elderly_ages:
            age_row = code_data[code_data[5] == age]
            if not age_row.empty:
                val = pd.to_numeric(age_row.iloc[0][6], errors='coerce')
                if not pd.isna(val):
                    elderly_pop += val
        
        # 高齢者割合を計算
        code_5digit = code.zfill(5)
        result[code_5digit] = round((elderly_pop / total_pop) * 100, 2)
    
    print(f"Calculated elderly ratio for {len(result)} municipalities.")
    return result


def main():
    script_dir = Path(__file__).parent
    data_dir = script_dir.parent / "data"
    output_dir = script_dir.parent / "frontend" / "public" / "data"
    output_dir.mkdir(parents=True, exist_ok=True)
    
    # Inputs
    path_2020 = data_dir / "b01_01.xlsx"
    output_path = output_dir / "demographics.json"
    
    # ---------------------------------------------------------
    # 1. Load elderly ratio from b03_03.xlsx
    # ---------------------------------------------------------
    elderly_ratios = load_elderly_ratio(data_dir)
    
    # ---------------------------------------------------------
    # 2. Process population growth from b01_01.xlsx
    # ---------------------------------------------------------
    print(f"Reading 2020 Data: {path_2020}")
    df_preview = pd.read_excel(path_2020, header=None, nrows=20)
    
    header_row_idx = -1
    for i, row in df_preview.iterrows():
        row_str = " ".join([str(v) for v in row.values])
        if "地域識別コード" in row_str:
            header_row_idx = i
            break
            
    if header_row_idx == -1:
        print("Error: Could not find '地域識別コード' in 2020 Excel.")
        return

    print(f"Found header at row {header_row_idx}")

    # Read data skipping headers
    df_2020 = pd.read_excel(path_2020, header=None, skiprows=15)
    
    # Column mapping:
    # Col 5: 2020年_地域コード
    # Col 7: Total 2020
    # Col 12: Growth Rate (%)
    
    col_code = 5
    col_total = 7
    col_growth = 12
    
    result = {}

    for _, row in df_2020.iterrows():
        try:
            code_val = str(row[col_code]).strip()
            
            if not code_val.isdigit():
                continue
            
            code = code_val.zfill(5)
            
            t = pd.to_numeric(row[col_total], errors='coerce')
            growth = pd.to_numeric(row[col_growth], errors='coerce')
            
            if pd.isna(t): continue
            
            stats = {}
                
            if not pd.isna(growth):
                stats['pop_growth'] = round(growth, 2)
            else:
                t15 = pd.to_numeric(row[10], errors='coerce')
                if not pd.isna(t15) and t15 > 0:
                     stats['pop_growth'] = round(((t - t15) / t15) * 100, 2)
                else:
                     stats['pop_growth'] = None
            
            # Add elderly ratio from b03_03.xlsx
            stats['elderly_ratio'] = elderly_ratios.get(code)
            
            # Only save if we have at least one valid stat
            if stats['pop_growth'] is not None or stats['elderly_ratio'] is not None:
                result[code] = stats
                
        except Exception as e:
            continue
            
    print(f"Calculated demographics for {len(result)} municipalities.")
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
        
    print(f"Saved to {output_path}")

if __name__ == "__main__":
    main()
