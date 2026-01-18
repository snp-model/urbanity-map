"""経済センサスデータの分析スクリプト

経済センサスの「産業(小分類)別民営事業所数」データを分析し、
OpenStreetMapのPOIデータの代替可能性を検討する。
"""

import pandas as pd
import sys
from pathlib import Path
import json

def analyze_excel_structure(file_path: Path):
    """エクセルファイルの構造を分析"""
    print(f"=== ファイル分析: {file_path} ===\n")
    
    # シート一覧を取得
    excel_file = pd.ExcelFile(file_path)
    print(f"シート数: {len(excel_file.sheet_names)}")
    print(f"シート名: {excel_file.sheet_names}\n")
    
    # 最初のシートを詳細分析
    sheet_name = excel_file.sheet_names[0]
    print(f"\n--- シート: {sheet_name} の詳細分析 ---")
    
    # ヘッダー行を探す
    df_raw = pd.read_excel(file_path, sheet_name=sheet_name, header=None, nrows=50)
    print("\n最初の50行のサンプル:")
    for i in range(min(50, len(df_raw))):
        row_preview = str(df_raw.iloc[i].tolist()[:10])  # 最初の10列のみ表示
        print(f"行{i}: {row_preview}")
    
    # データの開始行を推定
    print("\n\n=== データ構造の推定 ===")
    for start_row in range(20):
        df_test = pd.read_excel(file_path, sheet_name=sheet_name, header=start_row, nrows=5)
        print(f"\nヘッダー行={start_row}の場合:")
        print(f"列名: {df_test.columns.tolist()[:10]}")  # 最初の10列のみ
        print("データサンプル:")
        print(df_test.head(2).to_string())

def analyze_data_content(file_path: Path):
    """データ内容を分析"""
    print("\n\n=== データ内容の分析 ===\n")
    
    # 適切なヘッダー行を指定してデータを読み込む
    # 経済センサスのエクセルは通常、最初の数行がタイトルや説明
    # ヘッダー行を手動で確認して指定する必要がある
    
    # まず、どの行がヘッダーかを特定
    df_raw = pd.read_excel(file_path, header=None, nrows=20)
    
    print("最初の20行を確認:")
    for i, row in df_raw.iterrows():
        # 最初の5列のみ表示
        preview = [str(val)[:30] for val in row[:5].tolist()]
        print(f"行{i}: {preview}")

def compare_with_osm(file_path: Path):
    """OpenStreetMapのPOIデータとの比較検討"""
    print("\n\n=== OpenStreetMapとの比較検討 ===\n")
    
    # 既存のPOIデータを読み込む
    poi_data_path = Path("../frontend/public/data/poi-data.json")
    
    if poi_data_path.exists():
        with open(poi_data_path, 'r', encoding='utf-8') as f:
            poi_data = json.load(f)
        
        print("既存のOSM POIデータ:")
        print(f"  - 市区町村数: {len(poi_data)}")
        
        # サンプルデータを表示
        sample_cities = list(poi_data.keys())[:3]
        for city_code in sample_cities:
            city_data = poi_data[city_code]
            print(f"\n  - {city_code}:")
            print(f"    総POI数: {city_data.get('total', 0)}")
            if 'categories' in city_data:
                print(f"    カテゴリ数: {len(city_data['categories'])}")
                print(f"    カテゴリ例: {list(city_data['categories'].keys())[:5]}")
    else:
        print(f"OSM POIデータが見つかりません: {poi_data_path}")
    
    print("\n\n経済センサスデータの特徴:")
    print("  ✓ 公的統計データで信頼性が高い")
    print("  ✓ 産業分類別の事業所数が正確")
    print("  ✓ 全国一律の基準で集計されている")
    print("  ✓ 定期的に更新される（5年ごと）")
    
    print("\nOpenStreetMapデータの特徴:")
    print("  ✓ リアルタイムで更新可能")
    print("  ✓ 施設の詳細情報（名称、住所など）が含まれる")
    print("  ✓ 地理座標が正確")
    print("  ✗ データの網羅性・正確性が地域によって異なる")
    
    print("\n\n代替可能性の評価:")
    print("  1. データの信頼性: 経済センサス > OSM")
    print("  2. データの鮮度: OSM > 経済センサス")
    print("  3. 地理的精度: OSM > 経済センサス（市区町村単位）")
    print("  4. カテゴリ分類: 産業分類 vs POIタグ（用途が異なる）")
    
    print("\n\n推奨事項:")
    print("  → 経済センサスデータを「補完データ」として活用")
    print("  → OSMデータと組み合わせて都会度スコアの精度を向上")
    print("  → 産業分類を適切にPOIカテゴリにマッピングする必要あり")

def main():
    # ファイルパス（scriptsディレクトリから見た相対パス）
    file_path = Path("../data/economic-census/c1_004_1a.xlsx")
    
    if not file_path.exists():
        print(f"エラー: ファイルが見つかりません: {file_path}")
        sys.exit(1)
    
    # 構造分析
    # analyze_excel_structure(file_path)
    
    # データ内容分析
    analyze_data_content(file_path)
    
    # OSMとの比較
    compare_with_osm(file_path)

if __name__ == "__main__":
    main()
