"""国勢調査データから市区町村別人口データを処理するスクリプト

2020年国勢調査の公式データ（Excelファイル）から市区町村別の人口を抽出し、
より正確な人口データを提供します。

使用方法:
    cd scripts
    uv run process_census_population.py
"""

import json
import sys
from pathlib import Path

import numpy as np
import numpy.typing as npt
import pandas as pd


def main() -> None:
    # パス設定
    script_dir: Path = Path(__file__).parent
    data_dir: Path = script_dir.parent / "data"
    output_dir: Path = script_dir.parent / "frontend" / "public" / "data"

    # 入力ファイル
    b01_path: Path = data_dir / "b01_01.xlsx"
    b03_path: Path = data_dir / "b03_03.xlsx"

    # 出力ファイル
    output_path: Path = output_dir / "population-score.json"
    raw_data_path: Path = output_dir / "population-data.json"

    # 出力ディレクトリが存在しない場合は作成
    output_dir.mkdir(parents=True, exist_ok=True)

    # まず、どちらかのファイルが存在するか確認
    census_file = None
    if b01_path.exists():
        census_file = b01_path
        print(f"国勢調査データを読み込み中: {census_file.name}")
    elif b03_path.exists():
        census_file = b03_path
        print(f"国勢調査データを読み込み中: {census_file.name}")
    else:
        print(f"エラー: 国勢調査データが見つかりません")
        print(f"  - {b01_path}")
        print(f"  - {b03_path}")
        sys.exit(1)

    # Excelファイルを読み込み（14行目がヘッダー）
    print("データを読み込み中...")
    df = pd.read_excel(census_file, sheet_name=0, header=14)
    
    print(f"読み込んだデータ: {len(df)} 行")
    print(f"\nカラム情報:")
    for i, col in enumerate(df.columns):
        print(f"  [{i}]: {col}")
    
    # データの最初の数行を表示
    print(f"\n最初の10行のデータサンプル:")
    sample_cols = [df.columns[0], df.columns[5], df.columns[6], df.columns[7]]
    print(df[sample_cols].head(10).to_string())
    
    # 地域識別コードと地域名、人口のカラムを特定
    code_col = df.columns[0]  # '地域識別コード'
    region_name_col = df.columns[6]  # '地域名'
    population_col = df.columns[7]  # 総数（人口）
    
    print(f"\n使用するカラム:")
    print(f"  コード: {code_col}")
    print(f"  地域名: {region_name_col}")
    print(f"  人口: {population_col}")
    
    # 有効なデータのみを抽出
    # '0' = 特別区（東京23区）, '1' = 政令市の区, '2' = 市, '3' = 町村
    df_filtered = df[df[code_col].isin(['0', '1', '2', '3'])].copy()
    print(f"\n市区町村レベルのデータ: {len(df_filtered)} 件")
    
    # 2020年の地域コード（市区町村コード）を抽出
    # カラム5が2020年の地域コード
    mun_code_col = df.columns[5]  # '2020年_地域コード'
    
    print(f"\nサンプルデータ:")
    sample_data = df_filtered[[mun_code_col, region_name_col, population_col]].head(10)
    print(sample_data.to_string())
    
    # データをクリーンアップ
    df_filtered[mun_code_col] = df_filtered[mun_code_col].astype(str).str.strip()
    df_filtered[population_col] = pd.to_numeric(df_filtered[population_col], errors='coerce')
    
    # 欠損値を除外
    df_clean = df_filtered.dropna(subset=[mun_code_col, population_col])
    df_clean = df_clean[df_clean[population_col] > 0]
    
    print(f"\nクリーンアップ後: {len(df_clean)} 件")
    
    # 市区町村コードを5桁に整形
    df_clean[mun_code_col] = df_clean[mun_code_col].str.zfill(5)
    
    # スコア算出（対数スケール）
    print("\n人口スコアを算出中...")
    pop_values: npt.NDArray[np.float64] = df_clean[population_col].values.astype(np.float64)
    pop_values = np.where(pop_values > 0, pop_values, 1)
    log_pop: npt.NDArray[np.float64] = np.log10(pop_values)
    
    min_val: float = float(log_pop.min())
    max_val: float = float(log_pop.max())
    
    normalized: npt.NDArray[np.float64]
    if max_val > min_val:
        normalized = ((log_pop - min_val) / (max_val - min_val) * 100).round(1)
    else:
        normalized = np.zeros_like(log_pop)
    
    df_clean['score'] = normalized
    
    # スコアデータを保存
    result: dict[str, float] = {}
    for _, row in df_clean.iterrows():
        code: str = str(row[mun_code_col])
        result[code] = float(row['score'])
    
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    
    # 実数値データの保存
    raw_result: dict[str, dict[str, float]] = {}
    for _, row in df_clean.iterrows():
        code: str = str(row[mun_code_col])
        raw_result[code] = {
            'count': int(row[population_col]),
            'score': float(row['score'])
        }
    
    with open(raw_data_path, 'w', encoding='utf-8') as f:
        json.dump(raw_result, f, ensure_ascii=False, indent=2)
    
    print(f"\n処理完了:")
    print(f"  スコアデータ: {output_path}")
    print(f"  実数値データ: {raw_data_path}")
    print(f"  対象市区町村数: {len(result)}")
    print(f"  スコア範囲: {normalized.min():.1f} - {normalized.max():.1f}")
    print(f"  人口範囲: {int(pop_values.min()):,} - {int(pop_values.max()):,} 人")
    
    # サンプルを表示
    print(f"\nサンプルデータ（最初の5件）:")
    for code, data in list(raw_result.items())[:5]:
        region = df_clean[df_clean[mun_code_col] == code][region_name_col].iloc[0]
        print(f"  {code} ({region}): {data['count']:,} 人 (スコア: {data['score']:.1f})")


if __name__ == "__main__":
    main()
