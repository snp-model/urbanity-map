"""人口メッシュデータ処理スクリプト (最適化版v3)

国土数値情報の500mメッシュ人口データから各市区町村の人口密度スコアを算出し、
夜間光データと統合するためのJSONファイルを出力します。

改善点:
- メモリ使用量を削減するためにファイルを1つずつ処理
- マッチング精度向上のためにメッシュの重心点を使用
- 再帰的なファイル検索に対応
- [v2] ファイル名から都道府県を特定して空間結合対象を絞り込み高速化
- [v3] デバッグログ追加

使用方法:
    cd scripts
    uv run process_population.py
"""

import json
import re
import sys
import warnings
from pathlib import Path

import geopandas as gpd
import numpy as np
import numpy.typing as npt
import pandas as pd

# CRS変換などの警告を抑制
warnings.filterwarnings('ignore')

def main() -> None:
    # パス設定
    script_dir: Path = Path(__file__).parent
    data_dir: Path = script_dir.parent / "data"
    output_dir: Path = script_dir.parent / "frontend" / "public" / "data"

    population_mesh_dir: Path = data_dir / "population_mesh"
    municipalities_path: Path = data_dir / "geojson-s0001" / "N03-21_210101.json"
    output_path: Path = output_dir / "population-score.json"

    # 出力ディレクトリが存在しない場合は作成
    output_dir.mkdir(parents=True, exist_ok=True)

    if not municipalities_path.exists():
        print(f"エラー: 市区町村境界が見つかりません: {municipalities_path}")
        sys.exit(1)

    print("市区町村境界を読み込み中...")
    municipalities_gdf: gpd.GeoDataFrame = gpd.read_file(municipalities_path)

    # 市区町村コードカラムを特定
    code_col: str | None = None
    for col in ['N03_007', 'code', 'id', 'JCODE']:
        if col in municipalities_gdf.columns:
            code_col = col
            break

    if code_col is None:
        print(f"エラー: 市区町村コードカラムが見つかりません。")
        sys.exit(1)
    
    # 文字列型に変換（startswith用）
    municipalities_gdf[code_col] = municipalities_gdf[code_col].astype(str)

    print(f"市区町村コードカラム: '{code_col}' (対象: {len(municipalities_gdf)} 自治体)")

    # 人口メッシュデータを再帰的に検索
    print("人口メッシュデータを検索中...")
    mesh_files: list[Path] = list(population_mesh_dir.glob("**/*.geojson")) + list(
        population_mesh_dir.glob("**/*.json")
    )

    if not mesh_files:
        print(f"エラー: 人口メッシュファイルが見つかりません: {population_mesh_dir}")
        sys.exit(1)

    print(f"見つかったメッシュファイル数: {len(mesh_files)}")

    # メモリ効率化のため、ファイルを一つずつ処理して集計結果のみを保持する
    aggregated_results: list[pd.DataFrame] = []
    
    # 人口カラム名の候補（優先度順）
    pop_col_candidates = ['PTN_2020', 'PTN2020', 'POP', 'population', 'PT0_2020', 'PTN_2025', 'PTN_2030']
    pop_col: str | None = None

    for i, mesh_file in enumerate(mesh_files):
        try:
            print(f"[{i+1}/{len(mesh_files)}] 処理中: {mesh_file.name}")
            
            # ファイル名から都道府県コード(2桁)を抽出して高速化
            # 例: 500m_mesh_2024_09.geojson -> 09
            pref_code = None
            match = re.search(r'_(\d{2})(?:_|\.)', mesh_file.name)
            if match:
                pref_code = match.group(1)
            
            # GeoDataFrame読み込み
            gdf: gpd.GeoDataFrame = gpd.read_file(mesh_file)
            
            if len(gdf) == 0:
                continue

            # 人口カラムの検出（初回のみ、または未検出の場合）
            if pop_col is None:
                for col in pop_col_candidates:
                    if col in gdf.columns:
                        pop_col = col
                        break
                
                if pop_col is None:
                    # 数値カラムを探す
                    numeric_cols = gdf.select_dtypes(include=[np.number]).columns.tolist()
                    if numeric_cols:
                        pop_col = numeric_cols[0]
                
                if pop_col:
                    print(f"  人口カラムとして '{pop_col}' を使用します")

            if pop_col and pop_col not in gdf.columns:
                print(f"  警告: '{mesh_file.name}' にカラム '{pop_col}' がありません。スキップします。")
                continue

            # CRS統一
            if gdf.crs != municipalities_gdf.crs:
                gdf = gdf.to_crs(municipalities_gdf.crs)

            # 重心点計算 (Polygon -> Point)
            gdf.geometry = gdf.geometry.centroid

            # 空間結合の対象を絞り込む
            if pref_code:
                # 都道府県コードでフィルタリング
                target_mun = municipalities_gdf[municipalities_gdf[code_col].str.startswith(pref_code)]
                if len(target_mun) == 0:
                    # 念のため全件
                    target_mun = municipalities_gdf
                    print(f"  警告: Pref {pref_code} の自治体が見つかりません。全件を使用します。")
                else:
                    print(f"  対象自治体を絞り込み: {len(target_mun)} 件 (Pref: {pref_code})")
            else:
                target_mun = municipalities_gdf
                print("  警告: 都道府県コードを特定できません。全件を使用します。")

            # 空間結合 (Inner Join)
            joined: gpd.GeoDataFrame = gpd.sjoin(
                gdf, 
                target_mun[[code_col, 'geometry']], 
                how='inner', 
                predicate='within'
            )

            # 集計
            if pop_col:
                joined[pop_col] = joined[pop_col].fillna(0).astype(float)
                sub_agg = joined.groupby(code_col)[pop_col].sum().reset_index()
                sub_agg.columns = [code_col, 'total_pop']
                aggregated_results.append(sub_agg)

        except Exception as e:
            print(f"  エラー: {mesh_file.name} の処理中に例外が発生: {e}")
            continue

    if not aggregated_results:
        print("エラー: 有効な集計結果が得られませんでした")
        sys.exit(1)

    print("全ファイルの集計結果を統合中...")
    total_df: pd.DataFrame = pd.concat(aggregated_results, ignore_index=True)
    
    # 最終集計
    final_agg: pd.DataFrame = total_df.groupby(code_col)['total_pop'].sum().reset_index()

    # スコア算出 logic
    print("人口スコアを算出中...")
    pop_values: npt.NDArray[np.float64] = final_agg['total_pop'].values.astype(np.float64)
    pop_values = np.where(pop_values > 0, pop_values, 0.001)
    log_pop: npt.NDArray[np.float64] = np.log10(pop_values + 1)

    min_val: float = float(log_pop.min())
    max_val: float = float(log_pop.max())

    normalized: npt.NDArray[np.float64]
    if max_val > min_val:
        normalized = ((log_pop - min_val) / (max_val - min_val) * 100).round(1)
    else:
        normalized = np.zeros_like(log_pop)

    final_agg['score'] = normalized

    # 結果保存
    result: dict[str, float] = {}
    for _, row in final_agg.iterrows():
        code: str = str(row[code_col])
        if len(code) < 5:
            code = code.zfill(5)
        result[code] = float(row['score'])

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print(f"処理完了: {output_path}")
    print(f"対象市区町村数: {len(result)}")
    print(f"スコア範囲: {normalized.min():.1f} - {normalized.max():.1f}")

if __name__ == "__main__":
    main()
