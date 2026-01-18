"""経済センサスデータの詳細分析と処理スクリプト

経済センサスの「産業(小分類)別民営事業所数」データを処理し、
都会度スコア算出用のデータとして活用可能な形式に変換する。
"""

import pandas as pd
import json
from pathlib import Path
from typing import Dict, Any

def load_economic_census_data(file_path: Path) -> pd.DataFrame:
    """経済センサスデータを読み込む
    
    Args:
        file_path: エクセルファイルのパス
        
    Returns:
        処理済みのDataFrame
    """
    # 行7に産業分類名、行10以降がデータ
    # まず行7を列名として読み込む
    df_header = pd.read_excel(file_path, header=7, nrows=0)
    industry_columns = df_header.columns.tolist()
    
    # 行10以降をデータとして読み込む
    df = pd.read_excel(file_path, header=10)
    
    # 列名を確認
    print("=== データ読み込み完了 ===")
    print(f"総行数: {len(df)}")
    print(f"総列数: {len(df.columns)}")
    print(f"\n列名（最初の10個）: {df.columns.tolist()[:10]}")
    
    # 産業分類の列名を取得（行7から）
    print(f"\n産業分類の列名（最初の10個）: {industry_columns[:10]}")
    
    # データサンプルを表示
    print(f"\nデータサンプル（最初の3行）:")
    print(df.head(3).to_string())
    
    return df, industry_columns

def analyze_industry_categories(df: pd.DataFrame, industry_columns: list):
    """産業分類を分析"""
    print("\n\n=== 産業分類の分析 ===")
    
    # 全国データのみを抽出（地域識別コード='a'）
    national_data = df[df['地域識別コード'] == 'a']
    
    if len(national_data) > 0:
        print("\n全国データ（最初の10列）:")
        print(national_data.iloc[:, :10].to_string())
        
        # 産業分類の列数
        # 最初の2列は地域識別コードと地域区分なので、それ以降が産業分類
        num_industry_cols = len(df.columns) - 2
        print(f"\n\n産業分類の列数: {num_industry_cols}")
        print(f"産業分類の例（最初の20個）:")
        
        # 行7の産業分類名を使用
        for i, col_name in enumerate(industry_columns[2:22]):  # 最初の20個
            if len(national_data) > 0:
                # 全国データの値を取得
                col_idx = i + 2  # 最初の2列をスキップ
                if col_idx < len(df.columns):
                    value = national_data.iloc[0, col_idx]
                    print(f"  {i+1}. {col_name}: {value}")

def extract_city_data(df: pd.DataFrame, industry_columns: list) -> Dict[str, Any]:
    """市区町村別のデータを抽出
    
    Args:
        df: 経済センサスのDataFrame
        industry_columns: 産業分類の列名リスト
        
    Returns:
        市区町村コードをキーとした辞書
    """
    print("\n\n=== 市区町村データの抽出 ===")
    
    # 地域区分列から市区町村コードを抽出
    # 形式: "01101_札幌市中央区"
    city_data = {}
    
    for idx, row in df.iterrows():
        region = row.get('地域区分', '')
        
        if isinstance(region, str) and '_' in region:
            parts = region.split('_')
            if len(parts) == 2:
                city_code = parts[0]
                city_name = parts[1]
                
                # 5桁のコードのみ（市区町村レベル）
                if len(city_code) == 5 and city_code != '00000':
                    # 非農林漁業（公務を除く）の事業所数を取得
                    # 列名に 'CR_非農林漁業' を含む列を探す
                    target_col_idx = -1
                    total_col_idx = -1
                    
                    for i, col in enumerate(industry_columns):
                        if isinstance(col, str):
                            if 'CR_非農林漁業' in col and '公務を除く' in col:
                                target_col_idx = i
                            elif 'AR_全産業' in col and '公務を除く' in col:
                                total_col_idx = i
                    
                    # 見つかった場合、データ行から値を取得（最初の2列はスキップされているので注意）
                    # industry_columnsはヘッダー行全体なので、インデックスはそのまま使えるはずだが
                    # dfの行データ(row)も同じ列構造を持っている
                    
                    # 非農林漁業
                    non_primary_establishments = 0
                    if target_col_idx >= 0 and target_col_idx < len(row):
                        val = row.iloc[target_col_idx]
                        if pd.notna(val):
                            non_primary_establishments = int(val) if isinstance(val, (int, float)) else 0
                            
                    # 全産業（参考用）
                    total_establishments = 0
                    if total_col_idx >= 0 and total_col_idx < len(row):
                        val = row.iloc[total_col_idx]
                        if pd.notna(val):
                            total_establishments = int(val) if isinstance(val, (int, float)) else 0
                    
                    # データが有効な場合のみ追加
                    if target_col_idx >= 0:
                        city_data[city_code] = {
                            'name': city_name,
                            'total_establishments': non_primary_establishments,  # メイン指標を非農林漁業に
                            'all_establishments': total_establishments,          # 参考用に全産業も保存
                            'industry_data': {}
                        }
                        
                        # 産業分類別のデータも保存（最初の2列をスキップ）
                        for col_idx in range(2, min(len(row), len(industry_columns))):
                            col_name = industry_columns[col_idx]
                            value = row.iloc[col_idx]
                            
                            if pd.notna(value) and isinstance(value, (int, float)):
                                city_data[city_code]['industry_data'][col_name] = int(value)
    
    print(f"抽出した市区町村数: {len(city_data)}")
    
    # サンプルデータを表示
    sample_cities = list(city_data.keys())[:5]
    print("\nサンプルデータ（最初の5市区町村）:")
    for city_code in sample_cities:
        data = city_data[city_code]
        print(f"\n  {city_code} - {data['name']}:")
        print(f"    総事業所数: {data['total_establishments']}")
        print(f"    産業分類データ項目数: {len(data['industry_data'])}")
        
        # 主要な産業分類のデータを表示
        if data['industry_data']:
            print(f"    主要産業分類:")
            for i, (ind_name, count) in enumerate(list(data['industry_data'].items())[:5]):
                print(f"      - {ind_name}: {count}")
    
    return city_data

def compare_with_existing_data(city_data: Dict[str, Any]):
    """既存のPOIデータと比較"""
    print("\n\n=== 既存データとの比較 ===")
    
    # 既存のPOIデータを読み込む
    poi_data_path = Path("../frontend/public/data/poi-data.json")
    
    if poi_data_path.exists():
        with open(poi_data_path, 'r', encoding='utf-8') as f:
            poi_data = json.load(f)
        
        print(f"\nOSM POIデータ: {len(poi_data)} 市区町村")
        print(f"経済センサスデータ: {len(city_data)} 市区町村")
        
        # 共通する市区町村を確認
        common_cities = set(poi_data.keys()) & set(city_data.keys())
        print(f"共通する市区町村: {len(common_cities)}")
        
        # サンプル比較
        print("\nサンプル比較（最初の5市区町村）:")
        for city_code in list(common_cities)[:5]:
            poi_total = poi_data[city_code].get('total', 0)
            census_total = city_data[city_code]['total_establishments']
            all_total = city_data[city_code].get('all_establishments', 0)
            
            print(f"\n  {city_code} - {city_data[city_code]['name']}:")
            print(f"    OSM POI数: {poi_total}")
            print(f"    経済センサス（非農林漁業）: {census_total}")
            print(f"    経済センサス（全産業）: {all_total}")
            
            if poi_total > 0:
                ratio = census_total / poi_total
                print(f"    比率（センサス/OSM）: {ratio:.2f}")
    else:
        print(f"\nOSM POIデータが見つかりません: {poi_data_path}")

def save_processed_data(city_data: Dict[str, Any], output_path: Path):
    """処理済みデータを保存"""
    print(f"\n\n=== データの保存 ===")
    print(f"保存先: {output_path}")
    
    # 簡略化したデータを作成
    simplified_data = {
        city_code: {
            'name': data['name'],
            'total_establishments': data['total_establishments'],  # 非農林漁業（公務を除く）
            'all_establishments': data.get('all_establishments', 0)
        }
        for city_code, data in city_data.items()
    }
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(simplified_data, f, ensure_ascii=False, indent=2)
    
    print(f"保存完了: {len(simplified_data)} 市区町村")

def main():
    # ファイルパス
    input_file = Path("../data/economic-census/c1_004_1a.xlsx")
    output_file = Path("../frontend/public/data/economic-census-data.json")
    
    if not input_file.exists():
        print(f"エラー: ファイルが見つかりません: {input_file}")
        return
    
    # データ読み込み
    df, industry_columns = load_economic_census_data(input_file)
    
    # 産業分類の分析
    analyze_industry_categories(df, industry_columns)
    
    # 市区町村データの抽出
    city_data = extract_city_data(df, industry_columns)
    
    # 既存データとの比較
    compare_with_existing_data(city_data)
    
    # データ保存
    save_processed_data(city_data, output_file)
    
    # 結論
    print("\n\n" + "="*60)
    print("=== 結論: OpenStreetMapとの代替可能性 ===")
    print("="*60)
    print("\n✅ 経済センサスデータは都会度算出に活用可能")
    print("\n【メリット】")
    print("  1. 公的統計で信頼性が高い")
    print("  2. 全国一律の基準で集計されている")
    print("  3. 市区町村単位で正確な事業所数が得られる")
    print("\n【デメリット】")
    print("  1. 5年ごとの更新でデータが古い可能性")
    print("  2. 産業分類とPOIカテゴリの対応付けが必要")
    print("  3. 地理座標情報がない（市区町村単位のみ）")
    print("\n【推奨される活用方法】")
    print("  → OSMデータの「補完」として使用")
    print("  → OSMデータが不足している地域の補正に活用")
    print("  → 総事業所数を新たな都会度指標として追加")
    print("  → 既存のPOIスコアと組み合わせて精度向上")
    print("\n【次のステップ】")
    print("  1. 経済センサスデータをスコア化")
    print("  2. 既存のPOIスコアとの相関を分析")
    print("  3. 統合スコアの算出方法を検討")
    print("="*60)

if __name__ == "__main__":
    main()
