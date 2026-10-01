"""4指標を統合した都会度スコアの算出スクリプト

夜間光・国勢調査人口・経済センサス事業所数・地価を統合し、総合都会度スコアを算出します。
また、光害度スコア（夜間光単独）も出力します。

使用方法:
    cd scripts
    uv run integrate_scores.py

前提条件:
    以下のスクリプトを事前に実行してスコアファイルを生成しておく必要があります：
    - uv run process_night_lights.py  # 夜間光スコア
    - uv run process_population.py    # 人口スコア

入力:
    - ../frontend/public/data/urbanity-score.json (夜間光スコア)
    - ../frontend/public/data/population-score.json (人口スコア)
    - ../frontend/public/data/population-data.json (国勢調査実数値)
    - ../frontend/public/data/economic-census-data.json (事業所数)
    - ../frontend/public/data/land_price.json (地価)
    - ../data/geojson-s0001/N03-21_210101.json (全国の基準形状)
    - ../data/geojson-s0001/N03-20250101.geojson (浜松市の新3区形状)

出力:
    - ../frontend/public/data/urbanity-score-v2.json (統合スコア)
    - ../frontend/public/data/japan-with-scores-v2.geojson (統合スコア付きGeoJSON)
"""

import json
import sys
from pathlib import Path

import geopandas as gpd
import numpy as np
import pandas as pd
import shapely
from shapely.ops import unary_union

from census_2025 import normalize_code
from urbanity_calibration import load_urbanity_calibration


HAMAMATSU_OLD_CODES = {"22131", "22132", "22133", "22134", "22135", "22136", "22137"}
HAMAMATSU_NEW_CODES = {"22138", "22139", "22140"}
HAMAMATSU_WARD_SIMPLIFICATION_TOLERANCE = 0.01  # roughly 1 km at Hamamatsu's latitude


def load_scores(path: Path) -> dict[str, float]:
    """スコアJSONファイルを読み込む。

    Args:
        path: JSONファイルのパス

    Returns:
        市区町村コードをキーとするスコアの辞書
    """
    if not path.exists():
        return {}
    with open(path, "r", encoding="utf-8") as f:
        # ネストされた辞書（実数値ファイル）の場合、単純な辞書としては扱えない可能性があるが
        # ここでは単純なスコアファイル（{code: score}）を想定
        return json.load(f)


def load_raw_data(path: Path) -> dict[str, dict[str, float]]:
    """実数値JSONファイルを読み込む。"""
    if not path.exists():
        return {}
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


def load_map_boundaries(data_dir: Path) -> gpd.GeoDataFrame:
    """Keep 2020 shapes and use Hamamatsu's 2025 wards within its 2020 outline."""
    geojson_dir = data_dir / "geojson-s0001"
    previous_path = geojson_dir / "N03-21_210101.json"
    current_path = geojson_dir / "N03-20250101.geojson"
    previous = gpd.read_file(previous_path)
    if "N03_007" not in previous.columns:
        raise ValueError(f"Municipality code column is missing from {previous_path}")

    previous["_municipality_code"] = previous["N03_007"].map(normalize_code)
    previous_codes = set(previous["_municipality_code"].dropna())
    if not HAMAMATSU_OLD_CODES.issubset(previous_codes):
        raise ValueError("The 2020 boundary is missing one or more former Hamamatsu wards")
    former_hamamatsu = previous.loc[
        previous["_municipality_code"].isin(HAMAMATSU_OLD_CODES)
    ]
    hamamatsu_2020_outline = unary_union(former_hamamatsu.geometry)
    previous = previous.loc[
        ~previous["_municipality_code"].isin(HAMAMATSU_OLD_CODES)
    ].drop(columns=["_municipality_code"])

    if not current_path.exists():
        raise FileNotFoundError(f"2025 boundary source not found: {current_path}")
    current_wards = gpd.read_file(
        current_path,
        where="N03_007 IN ('22138', '22139', '22140')",
        columns=[f"N03_{index:03}" for index in range(1, 6)] + ["N03_007"],
    )
    if "N03_007" not in current_wards.columns:
        raise ValueError(f"Municipality code column is missing from {current_path}")
    current_wards["N03_007"] = current_wards["N03_007"].map(normalize_code)
    current_wards = current_wards[
        current_wards["N03_007"].isin(HAMAMATSU_NEW_CODES)
    ].copy().sort_values("N03_007").reset_index(drop=True)
    if set(current_wards["N03_007"].dropna()) != HAMAMATSU_NEW_CODES:
        raise ValueError("The 2025 boundary does not contain all three Hamamatsu wards")

    if previous.crs is None or current_wards.crs is None:
        raise ValueError("Both Hamamatsu and previous boundary data must declare a CRS")
    if current_wards.crs != previous.crs:
        current_wards = current_wards.to_crs(previous.crs)
    current_wards = current_wards.dissolve(
        by="N03_007", as_index=False, aggfunc="first"
    ).sort_values("N03_007").reset_index(drop=True)

    # The 2025 source has a different outer boundary from the retained 2020
    # neighboring municipalities. Preserve the 2025 internal ward split, but
    # make the three wards' union inherit Hamamatsu's former outer boundary so
    # their edges meet the unchanged municipalities cleanly.
    official_geometries = list(current_wards.geometry)
    reconciled_geometries = []
    assigned = None
    for geometry in official_geometries:
        clipped = geometry.intersection(hamamatsu_2020_outline)
        if assigned is not None:
            clipped = clipped.difference(assigned)
        if clipped.is_empty:
            raise ValueError("A 2025 Hamamatsu ward became empty after boundary alignment")
        reconciled_geometries.append(clipped)
        assigned = clipped if assigned is None else unary_union([assigned, clipped])

    uncovered = hamamatsu_2020_outline.difference(assigned)

    def polygon_parts(geometry):
        if geometry.geom_type == "Polygon":
            return [geometry]
        if hasattr(geometry, "geoms"):
            return [part for child in geometry.geoms for part in polygon_parts(child)]
        return []

    # Assign any remainder to the nearest 2025 ward, rather than leaving a hole
    # along Hamamatsu's inherited outline.
    for part in polygon_parts(uncovered):
        nearest = min(
            range(len(reconciled_geometries)),
            key=lambda index: official_geometries[index].distance(part),
        )
        reconciled_geometries[nearest] = unary_union(
            [reconciled_geometries[nearest], part]
        )

    aligned_union = unary_union(reconciled_geometries)
    if hamamatsu_2020_outline.symmetric_difference(aligned_union).area > 1e-10:
        raise ValueError("Aligned Hamamatsu wards do not cover the retained 2020 outline")

    if not shapely.coverage_is_valid(reconciled_geometries):
        raise ValueError("Aligned Hamamatsu wards do not form a valid polygon coverage")
    # Match the coarser 2020 map detail: nearby municipality outlines typically
    # have about 8-39 vertices, while 0.002 degrees left 96/86 on these ward
    # borders. Simplify only shared/internal edges; keep the external 2020
    # outline untouched and preserve coverage topology to avoid seams.
    simplified_geometries = shapely.coverage_simplify(
        reconciled_geometries,
        tolerance=HAMAMATSU_WARD_SIMPLIFICATION_TOLERANCE,
        simplify_boundary=False,
    )
    simplified_union = unary_union(simplified_geometries)
    if not shapely.coverage_is_valid(simplified_geometries):
        raise ValueError("Simplified Hamamatsu wards do not form a valid polygon coverage")
    if aligned_union.boundary.symmetric_difference(
        simplified_union.boundary
    ).length > 1e-10:
        raise ValueError("Simplification changed Hamamatsu's external boundary")
    current_wards = current_wards.set_geometry(
        gpd.GeoSeries(simplified_geometries, index=current_wards.index, crs=previous.crs)
    )

    combined = gpd.GeoDataFrame(
        pd.concat([previous, current_wards], ignore_index=True),
        geometry="geometry",
        crs=previous.crs,
    )
    return combined


def main() -> None:
    """4指標を統合して総合都会度スコアを算出する。

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
    
    # Raw data paths
    population_raw_path: Path = public_data_dir / "population-data.json"
    
    # 経済センサスデータ
    census_path: Path = public_data_dir / "economic-census-data.json"

    # Keep the 2020 map geography throughout Japan. Hamamatsu's new ward split
    # is from 2025, with its exterior aligned to the retained 2020 outline.
    municipalities_path: Path = data_dir / "geojson-s0001" / "N03-21_210101.json"

    output_json_path: Path = public_data_dir / "urbanity-score-v2.json"
    output_geojson_path: Path = public_data_dir / "japan-with-scores-v2.geojson"

    if not municipalities_path.exists():
        print(f"エラー: 2020年市区町村境界が見つかりません: {municipalities_path}")
        sys.exit(1)
    municipality_gdf = load_map_boundaries(data_dir)
    code_col = next(
        (column for column in ["N03_007", "code", "id", "JCODE"] if column in municipality_gdf.columns),
        None,
    )
    if code_col is None:
        raise ValueError(f"Municipality code column is missing from {municipalities_path}")
    municipality_gdf["_municipality_code"] = municipality_gdf[code_col].map(normalize_code)
    current_codes = set(municipality_gdf["_municipality_code"].dropna())
    non_null_codes = municipality_gdf["_municipality_code"].notna().sum()
    if not current_codes or len(current_codes) != non_null_codes:
        raise ValueError("2020 map boundary contains duplicate or missing municipality codes")

    # 必須の夜間光スコアを確認
    if not night_light_path.exists():
        print(f"エラー: 夜間光スコアが見つかりません: {night_light_path}")
        print("先に process_night_lights.py を実行してください。")
        sys.exit(1)

    land_price_path: Path = public_data_dir / "land_price.json"
    tax_path: Path = public_data_dir / "tax_income.json"
    demographics_path: Path = public_data_dir / "demographics.json"
    weather_path: Path = public_data_dir / "weather-data.json"

    # 各層のスコアを読み込む
    print("各層のスコアと実数値を読み込み中...")
    night_light_scores: dict[str, float] = load_scores(night_light_path)
    population_scores: dict[str, float] = load_scores(population_path)
    
    # 経済センサスデータの読み込み
    census_data: dict[str, dict] = {}
    if census_path.exists():
        with open(census_path, "r", encoding="utf-8") as f:
            census_data = json.load(f)

    # 新しいデータ層の読み込み
    land_price_scores: dict[str, float] = load_scores(land_price_path)
    tax_scores: dict[str, float] = load_scores(tax_path)
    demographics_data: dict[str, dict] = {}
    if demographics_path.exists():
        with open(demographics_path, "r", encoding="utf-8") as f:
            demographics_data = json.load(f)

    # 気象データの読み込み
    weather_data: dict[str, dict] = {}
    if weather_path.exists():
        with open(weather_path, "r", encoding="utf-8") as f:
            weather_data = json.load(f)

    population_raw: dict[str, dict[str, float]] = load_raw_data(population_raw_path)

    # The available income source has no ward-level Hamamatsu figures. Preserve
    # the existing city-level fallback, and mark it so the UI can disclose it.
    hamamatsu_income_source = tax_scores.get("22130")
    if hamamatsu_income_source is None:
        hamamatsu_income_source = tax_scores.get("22100")
    citywide_income_codes: set[str] = set()
    if hamamatsu_income_source is not None:
        for code in HAMAMATSU_NEW_CODES:
            if tax_scores.get(code) is None:
                tax_scores[code] = hamamatsu_income_source
                citywide_income_codes.add(code)

    print(f"  夜間光スコア: {len(night_light_scores)} 市区町村")
    print(f"  人口スコア: {len(population_scores)} 市区町村")
    print(f"  事業所数データ: {len(census_data)} 市区町村")
    print(f"  地価データ: {len(land_price_scores)} 市区町村")
    print(f"  平均所得データ: {len(tax_scores)} 市区町村")
    print(f"  人口統計データ: {len(demographics_data)} 市区町村")
    print(f"  気象データ: {len(weather_data)} 市区町村")
    print("混合境界（2020年形状 + 浜松市2025年新3区）へのデータ適用範囲:")
    source_layers = [
        ("夜間光", night_light_scores),
        ("2025年国勢調査人口", population_raw),
        ("経済センサス事業所数", census_data),
        ("地価", land_price_scores),
        ("平均所得", tax_scores),
        ("人口統計", demographics_data),
        ("気象", weather_data),
    ]
    for label, values in source_layers:
        coverage = len(current_codes & set(values))
        print(f"  {label}: {coverage}/{len(current_codes)}")

    missing_hamamatsu_land_price = HAMAMATSU_NEW_CODES - set(land_price_scores)
    if missing_hamamatsu_land_price:
        print(
            "浜松市新3区の地価は地点データが未配置のため欠損として出力します。"
            "data/L01-26_GML/L01-26.geojson を用意して process_land_price.py を実行してください。"
        )

    # Keep all other areas on the previous (2020) map geography.
    all_codes: set[str] = set(current_codes)

    # Apply the PCA fitted once against the previous production (2020) inputs.
    print("2020年基準の固定モデルで統合スコアを算出中...")
    calibration = load_urbanity_calibration()["integrated_score"]
    expected_input_order = (
        "night_light",
        "population",
        "establishments",
        "land_price",
    )
    if tuple(calibration["input_order"]) != expected_input_order:
        raise ValueError("Urbanity calibration input order does not match the model")

    # データ行列の作成
    X = []
    codes = sorted(all_codes)
    valid_codes = []

    for code in codes:
        nl = night_light_scores.get(code, 0.0)
        pop = population_scores.get(code, 0.0)
        
        # 事業所数（実数）を取得
        est_data = census_data.get(code, {})
        est = est_data.get('total_establishments', 0) if isinstance(est_data, dict) else 0
        
        lp = land_price_scores.get(code, 0.0)  # 地価（円/㎡）

        # 全てのデータが揃っているものを分析対象とする
        if nl > 0 or pop > 0 or est > 0 or lp > 0:
            # Keep the calibrated input order and transform unchanged.
            X.append([np.log1p(nl), np.log1p(pop), np.log1p(est), np.log1p(lp)])
            valid_codes.append(code)

    X = np.array(X)

    # Check if X is empty
    if len(X) == 0:
        print("Error: No valid data for PCA.")
        return

    # Use saved 2020 standardization and PCA parameters; never refit on the
    # current census, so the same score continues to mean the same thing.
    scaler_mean = np.asarray(calibration["scaler_mean"], dtype=float)
    scaler_scale = np.asarray(calibration["scaler_scale"], dtype=float)
    pca_mean = np.asarray(calibration["pca_mean"], dtype=float)
    pca_component = np.asarray(calibration["pca_component"], dtype=float)
    if any(
        values.shape != (X.shape[1],)
        for values in (scaler_mean, scaler_scale, pca_mean, pca_component)
    ):
        raise ValueError("Urbanity calibration does not match the four expected inputs")
    if np.any(scaler_scale <= 0):
        raise ValueError("Urbanity calibration contains an invalid scaler scale")

    X_scaled = (X - scaler_mean) / scaler_scale
    pca_scores = (
        (X_scaled - pca_mean) @ pca_component * float(calibration["orientation"])
    )

    weights = np.abs(pca_component)
    weights_normalized = weights / np.sum(weights)
    print(
        f"算出された重み: 夜間光={weights_normalized[0]:.2f}, 人口={weights_normalized[1]:.2f}, 事業所数={weights_normalized[2]:.2f}, 地価={weights_normalized[3]:.2f}"
    )
    pca_min = float(calibration["pca_score_min"])
    pca_max = float(calibration["pca_score_max"])
    if pca_max <= pca_min:
        raise ValueError("Urbanity calibration contains an invalid PCA score range")
    normalized_scores = np.clip(
        (pca_scores - pca_min) / (pca_max - pca_min) * 100, 0, 100
    )
    normalized_scores = np.interp(
        normalized_scores,
        calibration["nonlinear_breakpoints"],
        calibration["nonlinear_scores"],
    )

    # This is a deliberate, versioned change to the displayed score scale.
    # Keep the 2020 PCA/scaler calibration above fixed; only remap its final
    # 0-100 output so scores around 70 are less crowded toward the urban end.
    output_remapping = calibration["output_remapping"]
    remap_inputs = np.asarray(output_remapping["input_scores"], dtype=float)
    remap_outputs = np.asarray(output_remapping["output_scores"], dtype=float)
    if (
        remap_inputs.ndim != 1
        or remap_outputs.shape != remap_inputs.shape
        or len(remap_inputs) < 2
        or not np.all(np.diff(remap_inputs) > 0)
        or not np.all(np.diff(remap_outputs) >= 0)
        or remap_inputs[0] != 0
        or remap_inputs[-1] != 100
        or remap_outputs[0] != 0
        or remap_outputs[-1] != 100
    ):
        raise ValueError("Urbanity calibration contains an invalid output remapping")
    normalized_scores = np.interp(normalized_scores, remap_inputs, remap_outputs)

    # 結果の格納
    integrated_scores: dict[str, dict[str, float | str | None]] = {}

    # 計算できたコードのスコアを格納
    score_map = {code: score for code, score in zip(valid_codes, normalized_scores)}

    for code in all_codes:
        final_score = score_map.get(code, 0.0)

        nl_score = night_light_scores.get(code, 0.0)
        pop_score = population_scores.get(code, 0.0)
        
        est_data = census_data.get(code, {})
        est_count = est_data.get('total_establishments', 0) if isinstance(est_data, dict) else 0

        # Raw/Additional Data
        pop_raw_data = population_raw.get(code, {})

        lp = land_price_scores.get(code, None)
        tax = tax_scores.get(code, None)
        demo = demographics_data.get(code, {})

        integrated_scores[code] = {
            "urbanity": round(final_score, 1),
            "light_pollution": round(nl_score, 1),
            "night_light": round(nl_score, 1),
            "population": round(pop_score, 1),  # Keep score for potential use?
            "population_count": pop_raw_data.get("count"),  # None when no Census row exists
            "establishment_count": est_count,  # 事業所数（非一次産業）
            # Additional Fields
            "land_price": lp,
            "avg_income": tax,
            "avg_income_source": (
                "citywide" if code in citywide_income_codes else None
            ),
            "pop_growth": demo.get("pop_growth"),
            # 'sex_ratio': demo.get('sex_ratio'), # Disabled per user request
            "elderly_ratio": demo.get("elderly_ratio"),
            # 気象データ
            "max_temp": weather_data.get(code, {}).get("max_temp"),
            "max_snow": weather_data.get(code, {}).get("max_snow"),
        }

    # Keep the prior municipality order when refreshing scores so a score-only
    # update does not reorder the entire generated JSON. Add any new codes in a
    # deterministic order.
    if output_json_path.exists():
        with open(output_json_path, "r", encoding="utf-8") as f:
            previous_codes = list(json.load(f))
    else:
        previous_codes = []
    ordered_codes = [code for code in previous_codes if code in integrated_scores]
    ordered_codes.extend(sorted(set(integrated_scores) - set(ordered_codes)))
    integrated_scores = {code: integrated_scores[code] for code in ordered_codes}

    # 統合スコアJSONを保存
    with open(output_json_path, "w", encoding="utf-8") as f:
        json.dump(integrated_scores, f, ensure_ascii=False, indent=2)

    print(f"統合スコアを保存しました: {output_json_path}")

    # GeoJSONにスコアを埋め込む
    print("GeoJSONにスコアを埋め込み中...")

    def get_prop(code_value, key):
        code = str(code_value).strip().zfill(5)
        return integrated_scores.get(code, {}).get(key)

    municipality_gdf["urbanity_v2"] = municipality_gdf["_municipality_code"].apply(
        lambda code: get_prop(code, "urbanity")
    )
    municipality_gdf["light_pollution"] = municipality_gdf["_municipality_code"].apply(
        lambda code: get_prop(code, "light_pollution")
    )
    municipality_gdf["population_score"] = municipality_gdf["_municipality_code"].apply(
        lambda code: get_prop(code, "population")
    )
    municipality_gdf["population_count"] = municipality_gdf["_municipality_code"].apply(
        lambda code: get_prop(code, "population_count")
    )
    municipality_gdf["establishment_count"] = municipality_gdf["_municipality_code"].apply(
        lambda code: get_prop(code, "establishment_count")
    )
    municipality_gdf["land_price"] = municipality_gdf["_municipality_code"].apply(
        lambda code: get_prop(code, "land_price")
    )
    municipality_gdf["avg_income"] = municipality_gdf["_municipality_code"].apply(
        lambda code: get_prop(code, "avg_income")
    )
    municipality_gdf["avg_income_source"] = municipality_gdf["_municipality_code"].apply(
        lambda code: get_prop(code, "avg_income_source")
    )
    municipality_gdf["pop_growth"] = municipality_gdf["_municipality_code"].apply(
        lambda code: get_prop(code, "pop_growth")
    )
    municipality_gdf["elderly_ratio"] = municipality_gdf["_municipality_code"].apply(
        lambda code: get_prop(code, "elderly_ratio")
    )
    municipality_gdf["max_temp"] = municipality_gdf["_municipality_code"].apply(
        lambda code: get_prop(code, "max_temp")
    )
    municipality_gdf["max_snow"] = municipality_gdf["_municipality_code"].apply(
        lambda code: get_prop(code, "max_snow")
    )
    municipality_gdf.drop(columns=["_municipality_code"], inplace=True)
    municipality_gdf.to_file(output_geojson_path, driver="GeoJSON", index=False)
    print(f"統合スコア付きGeoJSONを保存しました: {output_geojson_path}")

    # サマリーを表示
    urbanity_values: list[float] = [v["urbanity"] for v in integrated_scores.values()]
    print(f"\n=== 統合結果 ===")
    print(f"市区町村数: {len(integrated_scores)}")
    print(f"都会度スコア範囲: {min(urbanity_values):.1f} - {max(urbanity_values):.1f}")
    print(
        f"固定重み (2020基準): 夜間光={weights_normalized[0]:.2f}, 人口={weights_normalized[1]:.2f}, 事業所数={weights_normalized[2]:.2f}, 地価={weights_normalized[3]:.2f}"
    )


if __name__ == "__main__":
    main()
