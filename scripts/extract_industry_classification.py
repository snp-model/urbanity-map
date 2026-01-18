"""産業分類マスターデータの抽出スクリプト

r6_sanngyoub.xlsxから産業分類のマスターデータを抽出し、
JSONファイルとして保存する。
"""

import pandas as pd
import json
from pathlib import Path
from typing import Dict, List, Any

def extract_industry_classification(file_path: Path) -> List[Dict[str, Any]]:
    """産業分類マスターデータを抽出
    
    Args:
        file_path: エクセルファイルのパス
        
    Returns:
        産業分類のリスト
    """
    print("=== 産業分類マスターデータの抽出 ===\n")
    
    # ヘッダー行7でデータを読み込む
    df = pd.read_excel(file_path, sheet_name='Ⅰ産業分類【事業所】', header=7)
    
    print(f"総行数: {len(df)}")
    print(f"列名: {df.columns.tolist()}\n")
    
    # 産業分類データを抽出
    industries = []
    
    for idx, row in df.iterrows():
        # 階層が数値の行のみ（データ行）
        hierarchy = row.get('階層')
        if pd.notna(hierarchy):
            # 符号（列9）- これが実際の産業分類コード
            industry_code = row.iloc[9]
            if pd.notna(industry_code):
                industry_code = str(industry_code).strip()
            else:
                continue
            
            # 産業分類項目名（列10）
            industry_name = row.iloc[10]
            if pd.notna(industry_name):
                industry_name = str(industry_name).strip()
            else:
                continue
            
            # 大分類符号（列3）
            major_code = row.iloc[3]
            if pd.notna(major_code):
                major_code = str(major_code).strip()
            else:
                major_code = None
            
            # データを追加
            industry_data = {
                'code': industry_code,
                'name': industry_name,
                'hierarchy': int(hierarchy) if isinstance(hierarchy, float) else hierarchy,
                'sequence': int(row.iloc[2]) if pd.notna(row.iloc[2]) else None,
                'major_code': major_code,
            }
            
            industries.append(industry_data)
    
    print(f"抽出した産業分類数: {len(industries)}")
    
    # サンプルデータを表示
    print("\nサンプルデータ（最初の20件）:")
    for i, ind in enumerate(industries[:20]):
        print(f"  {i+1}. {ind['code']}: {ind['name']} (階層: {ind['hierarchy']})")
    
    return industries

def create_code_to_name_mapping(industries: List[Dict[str, Any]]) -> Dict[str, str]:
    """産業分類コードから名称へのマッピングを作成
    
    Args:
        industries: 産業分類のリスト
        
    Returns:
        コードから名称へのマッピング辞書
    """
    mapping = {}
    
    for ind in industries:
        code = ind['code']
        name = ind['name']
        mapping[code] = name
    
    return mapping

def save_industry_data(industries: List[Dict[str, Any]], mapping: Dict[str, str], output_dir: Path):
    """産業分類データを保存
    
    Args:
        industries: 産業分類のリスト
        mapping: コードから名称へのマッピング
        output_dir: 出力ディレクトリ
    """
    print("\n\n=== データの保存 ===")
    
    # 完全なデータを保存
    full_data_path = output_dir / "industry-classification-full.json"
    with open(full_data_path, 'w', encoding='utf-8') as f:
        json.dump(industries, f, ensure_ascii=False, indent=2)
    print(f"完全データ保存: {full_data_path}")
    
    # マッピングデータを保存
    mapping_path = output_dir / "industry-code-mapping.json"
    with open(mapping_path, 'w', encoding='utf-8') as f:
        json.dump(mapping, f, ensure_ascii=False, indent=2)
    print(f"マッピングデータ保存: {mapping_path}")
    
    print(f"\n保存完了: {len(industries)} 件の産業分類")

def main():
    # ファイルパス
    input_file = Path("../data/economic-census/r6_sanngyoub.xlsx")
    output_dir = Path("../frontend/public/data")
    
    if not input_file.exists():
        print(f"エラー: ファイルが見つかりません: {input_file}")
        return
    
    # 産業分類データを抽出
    industries = extract_industry_classification(input_file)
    
    # マッピングを作成
    mapping = create_code_to_name_mapping(industries)
    
    # データを保存
    save_industry_data(industries, mapping, output_dir)
    
    # サマリー
    print("\n\n" + "="*60)
    print("=== 産業分類マスターデータの抽出完了 ===")
    print("="*60)
    print(f"\n総産業分類数: {len(industries)}")
    print(f"\n主要な産業分類:")
    for ind in industries[:10]:
        print(f"  - {ind['code']}: {ind['name']}")
    print("\n...")
    print("\nこのデータを使用して、経済センサスの産業分類コードを")
    print("人間が読める名称に変換できます。")
    print("="*60)

if __name__ == "__main__":
    main()
