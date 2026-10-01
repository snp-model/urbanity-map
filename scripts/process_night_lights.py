"""夜間光データ処理スクリプト

VIIRS夜間光GeoTIFFデータから各市区町村の平均夜間光放射輝度を抽出し、
フロントエンドで使用するためのJSONファイルを出力します。

使用方法:
    cd scripts
    uv run process_night_lights.py

必要なデータファイル（手動でダウンロードが必要）:
    - ../data/night_lights.tif (日本のVIIRS年間合成GeoTIFF)
    - ../data/geojson-s0001/N03-25_250101.json (国土数値情報の2025年市区町村境界)

出力:
    - ../frontend/public/data/urbanity-score.json (スコア参照用JSON)
    - ../frontend/public/data/japan-with-scores.geojson (スコア埋め込み済みGeoJSON)
"""

import json
import sys
from pathlib import Path

from typing import TypedDict

import geopandas as gpd
import numpy as np
import numpy.typing as npt
from rasterstats import zonal_stats
from urbanity_calibration import load_urbanity_calibration


class ZonalStatResult(TypedDict, total=False):
    """ゾーン統計の結果型。"""

    mean: float | None


def main() -> None:
    """夜間光データを処理してアーバニティスコアを生成する。

    この関数は以下の処理を行います：
    1. 市区町村境界GeoJSONを読み込む
    2. 夜間光GeoTIFFのゾーン統計を計算する
    3. 対数変換と正規化で0-100のスコアに変換する
    4. スコア参照用JSONとスコア埋め込み済みGeoJSONを出力する

    Raises:
        SystemExit: データファイルが見つからない場合
    """
    # パス設定
    script_dir = Path(__file__).parent
    data_dir = script_dir.parent / "data"
    output_dir = script_dir.parent / "frontend" / "public" / "data"
    
    night_light_path = data_dir / "night_lights.tif"
    # 国土数値情報の2025年行政区域境界（市区町村コードで統合済み）
    municipalities_path = data_dir / "geojson-s0001" / "N03-25_250101.json"
    output_path = output_dir / "urbanity-score.json"
    
    # データファイルの存在確認
    if not night_light_path.exists():
        print(f"エラー: 夜間光データが見つかりません: {night_light_path}")
        print("yo5uke.comからダウンロードしてGeoTIFFファイルを配置してください。")
        sys.exit(1)
    
    if not municipalities_path.exists():
        print(f"エラー: 市区町村境界が見つかりません: {municipalities_path}")
        print("先に download_census_2025.py --with-boundaries と prepare_municipality_boundaries.py を実行してください。")
        sys.exit(1)
    
    # 出力ディレクトリが存在しない場合は作成
    output_dir.mkdir(parents=True, exist_ok=True)
    
    print("市区町村境界を読み込み中...")
    gdf = gpd.read_file(municipalities_path)
    
    # 市区町村コードカラムを特定
    # 国土数値情報は'N03_007'を使用
    code_col: str | None = None
    for col in ['N03_007', 'code', 'id', 'JCODE']:
        if col in gdf.columns:
            code_col = col
            break
    
    if code_col is None:
        print(f"エラー: 市区町村コードカラムが見つかりません。利用可能: {gdf.columns.tolist()}")
        sys.exit(1)
    
    print(f"市区町村コードカラム: '{code_col}'")
    print(f"読み込んだ市区町村数: {len(gdf)}")
    
    print("夜間光データのゾーン統計を計算中...")
    stats: list[ZonalStatResult] = zonal_stats(
        gdf,
        str(night_light_path),
        stats=['mean'],
        nodata=-999
    )
    
    # 平均値を抽出
    means: list[float] = [s['mean'] if s['mean'] is not None else 0.0 for s in stats]
    
    # 可視化のため対数変換を使用して0-100スケールに正規化
    # 夜間光の値は桁違いに変動する可能性がある
    means_array: npt.NDArray[np.float64] = np.array(means)
    means_array = np.where(means_array > 0, means_array, 0.001)  # log(0)を回避
    log_means: npt.NDArray[np.float64] = np.log10(means_array + 1)
    
    # Min-Max正規化で0-100にスケーリング
    night_light_calibration = load_urbanity_calibration()["layer_normalization"][
        "night_light"
    ]
    min_val = float(night_light_calibration["min"])
    max_val = float(night_light_calibration["max"])
    
    normalized: npt.NDArray[np.float64]
    if max_val > min_val:
        normalized = np.clip(
            (log_means - min_val) / (max_val - min_val) * 100, 0, 100
        ).round(1)
    else:
        normalized = np.zeros_like(log_means)
    
    # GeoDataFrameの各フィーチャーにスコアを追加
    gdf['score'] = normalized
    
    # 参照用のルックアップ辞書も作成
    result: dict[str, float] = {}
    for idx, row in gdf.iterrows():
        code = str(row[code_col])
        if len(code) < 5:
            code = code.zfill(5)
        result[code] = float(normalized[idx])
    
    # スコア参照用JSONを保存
    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)
    
    # MapLibre用のスコア埋め込み済みGeoJSONを保存
    geojson_output_path = output_dir / "japan-with-scores.geojson"
    gdf.to_file(geojson_output_path, driver='GeoJSON')
    
    print(f"アーバニティスコアを保存しました: {output_path}")
    print(f"スコア埋め込み済みGeoJSONを保存しました: {geojson_output_path}")
    print(f"スコア範囲: {normalized.min():.1f} - {normalized.max():.1f}")
    print(f"市区町村数: {len(result)}")


if __name__ == "__main__":
    main()
