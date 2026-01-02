"""3層統合スコア算出スクリプト

夜間光・人口・POIの3層スコアを統合し、総合都会度スコアを算出します。
また、光害度スコア（夜間光単独）も出力します。

使用方法:
    cd scripts
    uv run integrate_scores.py

前提条件:
    以下のスクリプトを事前に実行してスコアファイルを生成しておく必要があります：
    - uv run process_night_lights.py  # 夜間光スコア
    - uv run process_population.py    # 人口スコア
    - uv run process_poi.py           # POIスコア

入力:
    - ../frontend/public/data/urbanity-score.json (夜間光スコア)
    - ../frontend/public/data/population-score.json (人口スコア)
    - ../frontend/public/data/poi-score.json (POIスコア)
    - ../data/geojson-s0001/N03-21_210101.json (市区町村境界)

出力:
    - ../frontend/public/data/urbanity-score-v2.json (統合スコア)
    - ../frontend/public/data/japan-with-scores-v2.geojson (統合スコア付きGeoJSON)
"""

import json
import sys
from pathlib import Path

import geopandas as gpd
import numpy as np
import numpy.typing as npt


# 各層の重み（調整可能）
WEIGHTS: dict[str, float] = {
    'night_light': 0.4,  # ベース層（活動量）
    'population': 0.3,   # 居住層（定住量）
    'poi': 0.3,          # 機能層（利便性）
}


def load_scores(path: Path) -> dict[str, float]:
    """スコアJSONファイルを読み込む。

    Args:
        path: JSONファイルのパス

    Returns:
        市区町村コードをキーとするスコアの辞書
    """
    if not path.exists():
        return {}
    with open(path, 'r', encoding='utf-8') as f:
        return json.load(f)


def main() -> None:
    """3層スコアを統合して総合都会度スコアを算出する。

    この関数は以下の処理を行います：
    1. 各層のスコアファイルを読み込む
    2. 加重平均で総合スコアを算出する
    3. 光害度スコア（夜間光スコアそのまま）も含める
    4. 統合スコアJSONとGeoJSONを出力する

    Raises:
        SystemExit: 夜間光スコアが見つからない場合
    """
    # パス設定
    script_dir: Path = Path(__file__).parent
    data_dir: Path = script_dir.parent / "data"
    public_data_dir: Path = script_dir.parent / "frontend" / "public" / "data"

    night_light_path: Path = public_data_dir / "urbanity-score.json"
    population_path: Path = public_data_dir / "population-score.json"
    poi_path: Path = public_data_dir / "poi-score.json"
    municipalities_path: Path = data_dir / "geojson-s0001" / "N03-21_210101.json"

    output_json_path: Path = public_data_dir / "urbanity-score-v2.json"
    output_geojson_path: Path = public_data_dir / "japan-with-scores-v2.geojson"

    # 必須の夜間光スコアを確認
    if not night_light_path.exists():
        print(f"エラー: 夜間光スコアが見つかりません: {night_light_path}")
        print("先に process_night_lights.py を実行してください。")
        sys.exit(1)

    # 各層のスコアを読み込む
    print("各層のスコアを読み込み中...")
    night_light_scores: dict[str, float] = load_scores(night_light_path)
    population_scores: dict[str, float] = load_scores(population_path)
    poi_scores: dict[str, float] = load_scores(poi_path)

    print(f"  夜間光スコア: {len(night_light_scores)} 市区町村")
    print(f"  人口スコア: {len(population_scores)} 市区町村")
    print(f"  POIスコア: {len(poi_scores)} 市区町村")

    # 全市区町村コードの一覧を取得
    all_codes: set[str] = set(night_light_scores.keys())

    # 統合スコアを算出
    print("統合スコアを算出中...")
    integrated_scores: dict[str, dict[str, float]] = {}

    for code in all_codes:
        nl_score: float = night_light_scores.get(code, 0.0)
        pop_score: float = population_scores.get(code, 0.0)
        poi_score: float = poi_scores.get(code, 0.0)

        # 利用可能な層の重みを調整
        available_weights: dict[str, float] = {}
        scores: dict[str, float] = {}

        available_weights['night_light'] = WEIGHTS['night_light']
        scores['night_light'] = nl_score

        if pop_score > 0 or code in population_scores:
            available_weights['population'] = WEIGHTS['population']
            scores['population'] = pop_score

        if poi_score > 0 or code in poi_scores:
            available_weights['poi'] = WEIGHTS['poi']
            scores['poi'] = poi_score

        # 重みを正規化
        total_weight: float = sum(available_weights.values())
        if total_weight > 0:
            normalized_weights: dict[str, float] = {
                k: v / total_weight for k, v in available_weights.items()
            }
        else:
            normalized_weights = {'night_light': 1.0}

        # 加重平均
        integrated: float = sum(
            scores.get(k, 0.0) * normalized_weights.get(k, 0.0)
            for k in normalized_weights
        )

        integrated_scores[code] = {
            'urbanity': round(integrated, 1),
            'light_pollution': round(nl_score, 1),  # 光害度は夜間光そのまま
            'night_light': round(nl_score, 1),
            'population': round(pop_score, 1),
            'poi': round(poi_score, 1),
        }

    # 統合スコアJSONを保存
    with open(output_json_path, 'w', encoding='utf-8') as f:
        json.dump(integrated_scores, f, ensure_ascii=False, indent=2)

    print(f"統合スコアを保存しました: {output_json_path}")

    # GeoJSONにスコアを埋め込む
    if municipalities_path.exists():
        print("GeoJSONにスコアを埋め込み中...")
        gdf: gpd.GeoDataFrame = gpd.read_file(municipalities_path)

        # 市区町村コードカラムを特定
        code_col: str | None = None
        for col in ['N03_007', 'code', 'id', 'JCODE']:
            if col in gdf.columns:
                code_col = col
                break

        if code_col:
            # スコアを追加
            gdf['urbanity_v2'] = gdf[code_col].apply(
                lambda x: integrated_scores.get(str(x).zfill(5), {}).get('urbanity', 0.0)
            )
            gdf['light_pollution'] = gdf[code_col].apply(
                lambda x: integrated_scores.get(str(x).zfill(5), {}).get('light_pollution', 0.0)
            )
            gdf['population_score'] = gdf[code_col].apply(
                lambda x: integrated_scores.get(str(x).zfill(5), {}).get('population', 0.0)
            )
            gdf['poi_score'] = gdf[code_col].apply(
                lambda x: integrated_scores.get(str(x).zfill(5), {}).get('poi', 0.0)
            )

            # GeoJSONを保存
            gdf.to_file(output_geojson_path, driver='GeoJSON')
            print(f"統合スコア付きGeoJSONを保存しました: {output_geojson_path}")

    # サマリーを表示
    urbanity_values: list[float] = [v['urbanity'] for v in integrated_scores.values()]
    print(f"\n=== 統合結果 ===")
    print(f"市区町村数: {len(integrated_scores)}")
    print(f"都会度スコア範囲: {min(urbanity_values):.1f} - {max(urbanity_values):.1f}")
    print(f"重み設定: 夜間光={WEIGHTS['night_light']}, 人口={WEIGHTS['population']}, POI={WEIGHTS['poi']}")


if __name__ == "__main__":
    main()
