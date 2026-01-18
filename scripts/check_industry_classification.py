"""産業分類マスターデータの確認スクリプト"""

import pandas as pd
from pathlib import Path

def check_industry_classification(file_path: Path):
    """産業分類マスターデータを確認"""
    print("=== 産業分類マスターデータの確認 ===\n")
    
    excel_file = pd.ExcelFile(file_path)
    print(f"シート一覧: {excel_file.sheet_names}\n")
    
    # 最初のシート（事業所）を確認
    sheet_name = excel_file.sheet_names[0]
    print(f"\n--- シート: {sheet_name} ---\n")
    
    # 最初の30行を確認
    df_raw = pd.read_excel(file_path, sheet_name=sheet_name, header=None, nrows=30)
    print("最初の30行:")
    for i in range(min(30, len(df_raw))):
        row_data = df_raw.iloc[i].tolist()
        # NaNを除外して表示
        row_data_clean = [str(v) if pd.notna(v) else '' for v in row_data]
        print(f"行{i}: {row_data_clean}")
    
    # ヘッダーを推定して読み込み
    print("\n\n=== ヘッダー行を推定して読み込み ===\n")
    for header_row in range(10):
        print(f"\n--- ヘッダー行={header_row} ---")
        df_test = pd.read_excel(file_path, sheet_name=sheet_name, header=header_row, nrows=10)
        print(f"列名: {df_test.columns.tolist()}")
        print(f"データサンプル（最初の3行）:")
        print(df_test.head(3).to_string())

def main():
    file_path = Path("../data/economic-census/r6_sanngyoub.xlsx")
    
    if not file_path.exists():
        print(f"エラー: ファイルが見つかりません: {file_path}")
        return
    
    check_industry_classification(file_path)

if __name__ == "__main__":
    main()
