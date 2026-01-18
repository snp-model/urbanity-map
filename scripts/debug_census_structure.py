"""経済センサスデータの列名確認スクリプト"""

import pandas as pd
from pathlib import Path

def check_excel_structure(file_path: Path):
    """エクセルファイルの構造を詳細に確認"""
    print("=== エクセルファイルの構造確認 ===\n")
    
    # 生データを読み込む（ヘッダーなし）
    df_raw = pd.read_excel(file_path, header=None)
    
    print(f"総行数: {len(df_raw)}")
    print(f"総列数: {len(df_raw.columns)}\n")
    
    # 最初の15行を表示
    print("最初の15行:")
    for i in range(min(15, len(df_raw))):
        # 最初の10列のみ表示
        row_data = df_raw.iloc[i, :10].tolist()
        print(f"行{i}: {row_data}")
    
    # 各行の最初の非NaN値を確認
    print("\n\n各行の最初の非NaN値:")
    for i in range(min(20, len(df_raw))):
        row = df_raw.iloc[i]
        non_nan_values = [v for v in row if pd.notna(v) and str(v) != 'nan']
        if non_nan_values:
            print(f"行{i}: {non_nan_values[:5]}")
    
    # 異なるヘッダー行でデータを読み込んでみる
    print("\n\n=== 異なるヘッダー行での読み込みテスト ===")
    for header_row in [7, 8, 9, 10, 11]:
        print(f"\n--- ヘッダー行={header_row} ---")
        df_test = pd.read_excel(file_path, header=header_row, nrows=3)
        print(f"列数: {len(df_test.columns)}")
        print(f"列名（最初の10個）: {df_test.columns.tolist()[:10]}")
        print(f"データサンプル（最初の行）:")
        if len(df_test) > 0:
            print(f"  {df_test.iloc[0, :10].tolist()}")

def main():
    file_path = Path("../data/economic-census/c1_004_1a.xlsx")
    
    if not file_path.exists():
        print(f"エラー: ファイルが見つかりません: {file_path}")
        return
    
    check_excel_structure(file_path)

if __name__ == "__main__":
    main()
