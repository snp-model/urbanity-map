"""都道府県境界GeoJSON生成スクリプト

市区町村境界データから都道府県単位で形状を結合（Dissolve）し、
都道府県境界のみを含む軽量なGeoJSONファイルを生成します。

使用方法:
    cd scripts
    uv run generate_prefecture_borders.py

入力:
    - ../data/geojson-s0001/N03-21_210101.json (市区町村境界)

出力:
    - ../frontend/public/data/prefectures.geojson (都道府県境界)
"""

import json
import sys
from pathlib import Path

import geopandas as gpd


def main() -> None:
    # パス設定
    script_dir = Path(__file__).parent
    data_dir = script_dir.parent / "data"
    output_dir = script_dir.parent / "frontend" / "public" / "data"
    
    input_path = data_dir / "geojson-s0001" / "N03-21_210101.json"
    output_path = output_dir / "prefectures.geojson"
    
    # 入力確認
    if not input_path.exists():
        print(f"エラー: 入力ファイルが見つかりません: {input_path}")
        sys.exit(1)
        
    print(f"市区町村データを読み込み中...: {input_path}")
    gdf = gpd.read_file(input_path)
    
    # 都道府県名カラムの特定
    pref_col = 'N03_001'
    if pref_col not in gdf.columns:
        print(f"エラー: 都道府県カラム {pref_col} が見つかりません。")
        sys.exit(1)
        
    print(f"都道府県単位で結合中... (元のフィーチャー数: {len(gdf)})")
    
    # 都道府県でDissolve
    # as_index=False にしないと都道府県名がインデックスになってしまい、GeoJSON出力時にプロパティとして残らない場合がある
    pref_gdf = gdf.dissolve(by=pref_col, as_index=False)
    
    # 必要なカラムのみ残す（都道府県名のみあればよい）
    pref_gdf = pref_gdf[[pref_col, 'geometry']]
    
    print(f"結合完了 (都道府県数: {len(pref_gdf)})")
    
    # 簡素化（トポロジー保持のため、元のデータが既に簡素化されているならスキップしても良いが、念のため）
    # 0.001度 ≒ 100m 程度の許容誤差
    # pref_gdf['geometry'] = pref_gdf['geometry'].simplify(tolerance=0.001, preserve_topology=True)
    
    # 出力
    print(f"保存中...: {output_path}")
    output_dir.mkdir(parents=True, exist_ok=True)
    pref_gdf.to_file(output_path, driver='GeoJSON')
    
    print("完了しました。")

if __name__ == "__main__":
    main()
