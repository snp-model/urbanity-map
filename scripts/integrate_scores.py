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


import json
from pathlib import Path

import geopandas as gpd
import pandas as pd
import numpy as np
from sklearn.decomposition import PCA
from sklearn.preprocessing import StandardScaler

# データに基づく重み計算を行うため、固定の重み定義は削除



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
    print("PCAによる重み計算と統合スコアの算出中...")

    # データ行列の作成
    X = []
    codes = sorted(all_codes)
    valid_codes = []

    for code in codes:
        nl = night_light_scores.get(code, 0.0)
        pop = population_scores.get(code, 0.0)
        poi = poi_scores.get(code, 0.0)
        
        # 全てのデータが揃っているものを分析対象とする
        if nl > 0 or pop > 0 or poi > 0:
            # 対数変換を適用して分布の偏りを緩和 (log(x + 1))
            # これにより、低いスコア部分の差が見えやすくなり、全体的に緑一色になるのを防ぐ
            X.append([np.log1p(nl), np.log1p(pop), np.log1p(poi)])
            valid_codes.append(code)

    X = np.array(X)

    # 標準化
    scaler = StandardScaler()
    X_scaled = scaler.fit_transform(X)

    # PCA実行（第一主成分）
    pca = PCA(n_components=1)
    pca_scores = pca.fit_transform(X_scaled).flatten()

    # 重み（寄与率）の確認と表示
    weights = np.abs(pca.components_[0])
    weights_normalized = weights / np.sum(weights)
    print(f"算出された重み: 夜間光={weights_normalized[0]:.2f}, 人口={weights_normalized[1]:.2f}, POI={weights_normalized[2]:.2f}")
    
    # 寄与率
    print(f"第一主成分の寄与率: {pca.explained_variance_ratio_[0]:.2f}")

    # スコアの向きを調整（夜間光と正の相関を持つようにする）
    # PCAの軸は反転することがあるため
    correlation = np.corrcoef(pca_scores, X[:, 0])[0, 1]
    if correlation < 0:
        pca_scores = -pca_scores

    # 0-100に正規化
    min_score = pca_scores.min()
    max_score = pca_scores.max()
    normalized_scores = (pca_scores - min_score) / (max_score - min_score) * 100

    # 結果の格納
    integrated_scores: dict[str, dict[str, float]] = {}
    
    # 計算できたコードのスコアを格納
    score_map = {code: score for code, score in zip(valid_codes, normalized_scores)}

    for code in all_codes:
        final_score = score_map.get(code, 0.0)
        
        nl_score = night_light_scores.get(code, 0.0)
        pop_score = population_scores.get(code, 0.0)
        poi_score = poi_scores.get(code, 0.0)
        
        integrated_scores[code] = {
            'urbanity': round(final_score, 1),
            'light_pollution': round(nl_score, 1),  # 光害度は夜間光そのまま
            'night_light': round(nl_score, 1),
            'population': round(pop_score, 1),
            'poi': round(poi_score, 1),
        }
        # （統合スコアは上で計算済み）
        
        # 光害度、夜間光、人口、POIスコアも一緒に保存（変更なし）
        # integrated_scores[code] は既に設定済み

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
    print(f"重み設定 (PCA): 夜間光={weights_normalized[0]:.2f}, 人口={weights_normalized[1]:.2f}, POI={weights_normalized[2]:.2f}")


if __name__ == "__main__":
    main()
