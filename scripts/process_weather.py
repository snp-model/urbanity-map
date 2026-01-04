"""気象庁データから最高気温と最深積雪を抽出して市区町村ごとに集計するスクリプト

気象庁の過去データCSVおよび観測所メタデータを読み込み、
各市区町村に最寄りの観測所データを紐付けて気象データJSONを出力します。

使用方法:
    cd scripts
    uv run process_weather.py

入力:
    - ../data/JMA/data*.csv (気象データ)
    - ../data/JMA/smaster.index (気象官署メタデータ)
    - ../data/JMA/ame_master_*.csv (アメダスメタデータ)
    - ../data/JMA/snow_master_*.csv (積雪観測所メタデータ)
    - ../data/geojson-s0001/N03-21_210101.json (市区町村境界)

出力:
    - ../frontend/public/data/weather-data.json
"""

import json
import warnings
from pathlib import Path

import geopandas as gpd
import pandas as pd
from shapely.geometry import Point

warnings.filterwarnings("ignore")


def parse_smaster_index(file_path: Path) -> pd.DataFrame:
    """気象官署メタデータを読み込む。"""
    stations = []

    with open(file_path, "r", encoding="shift_jis") as f:
        for line in f:
            parts = line.split()
            if len(parts) < 6:
                continue

            coord_str = None
            for p in parts:
                if p.isdigit() and len(p) == 13:
                    coord_str = p
                    break

            if not coord_str:
                continue

            try:
                lat_deg = int(coord_str[0:2])
                lat_min = int(coord_str[2:6]) / 100.0
                lat = lat_deg + lat_min / 60.0

                lon_deg = int(coord_str[6:9])
                lon_min = int(coord_str[9:13]) / 100.0
                lon = lon_deg + lon_min / 60.0

                # 日本語名を抽出
                jp_name = None
                for i, ch in enumerate(line):
                    if (
                        "\u4e00" <= ch <= "\u9fff"
                        or "\u3040" <= ch <= "\u309f"
                        or "\u30a0" <= ch <= "\u30ff"
                    ):
                        jp_part = line[i:].strip()
                        jp_name = (
                            jp_part.split()[0].replace("　", "") if jp_part else None
                        )
                        break

                if jp_name:
                    stations.append({"name": jp_name, "lat": lat, "lon": lon})
            except (ValueError, IndexError):
                continue

    df = pd.DataFrame(stations)
    df = df.drop_duplicates(subset=["name"], keep="last")
    return df


def parse_amedas_master(file_path: Path) -> pd.DataFrame:
    """アメダスマスターCSVを読み込む。

    フォーマット:
    都府県振興局,観測所番号,種類,観測所名,ｶﾀｶﾅ名,気象情報等に表記する名称,所在地,
    緯度(度),緯度(分),経度(度),経度(分),海面上の高さ(ｍ),...
    """
    stations = []

    # cp932でエラーを無視して読み込む
    with open(file_path, "r", encoding="cp932", errors="ignore") as f:
        lines = f.readlines()

    # ヘッダー行をスキップ
    for line in lines[1:]:
        parts = line.strip().split(",")
        if len(parts) < 11:
            continue

        try:
            name = parts[3].strip()  # 観測所名
            lat_deg = float(parts[7])
            lat_min = float(parts[8])
            lon_deg = float(parts[9])
            lon_min = float(parts[10])

            lat = lat_deg + lat_min / 60.0
            lon = lon_deg + lon_min / 60.0

            if name and lat > 0 and lon > 0:
                stations.append({"name": name, "lat": lat, "lon": lon})
        except (ValueError, IndexError):
            continue

    df = pd.DataFrame(stations)
    df = df.drop_duplicates(subset=["name"], keep="last")
    return df


def parse_jma_weather_csv(file_path: Path) -> pd.DataFrame:
    """気象庁CSVを読み込み、観測所ごとの最高気温と最深積雪を抽出する。"""
    with open(file_path, "r", encoding="shift_jis") as f:
        lines = f.readlines()

    if len(lines) < 7:
        return pd.DataFrame()

    station_row = lines[2].strip().split(",")
    data_type_row = lines[3].strip().split(",")

    station_data_cols = {}

    i = 1
    while i < len(station_row):
        station = station_row[i].strip()
        dtype = data_type_row[i].strip() if i < len(data_type_row) else ""

        if station and dtype:
            key = (station, dtype)
            if key not in station_data_cols:
                station_data_cols[key] = i

        i += 1

    data_lines = lines[6:]

    station_values = {}

    for key, col_idx in station_data_cols.items():
        station, dtype = key

        if station not in station_values:
            station_values[station] = {"max_temp": [], "max_snow": []}

        is_temp = "最高気温" in dtype
        is_snow = "最深積雪" in dtype

        if not (is_temp or is_snow):
            continue

        for line in data_lines:
            parts = line.strip().split(",")
            if col_idx < len(parts):
                val_str = parts[col_idx].strip()
                try:
                    val = float(val_str)
                    if is_temp:
                        station_values[station]["max_temp"].append(val)
                    elif is_snow:
                        station_values[station]["max_snow"].append(val)
                except ValueError:
                    pass

    results = []
    for station, values in station_values.items():
        temps = values["max_temp"]
        snows = values["max_snow"]

        max_temp = max(temps) if temps else None
        max_snow = max(snows) if snows else None

        if max_temp is not None or max_snow is not None:
            results.append(
                {"station_name": station, "max_temp": max_temp, "max_snow": max_snow}
            )

    return pd.DataFrame(results)


def main() -> None:
    """気象データを処理してJSONを出力する。"""
    script_dir = Path(__file__).parent
    data_dir = script_dir.parent / "data"
    jma_dir = data_dir / "JMA"
    output_dir = script_dir.parent / "frontend" / "public" / "data"
    output_dir.mkdir(parents=True, exist_ok=True)

    smaster_path = jma_dir / "smaster.index"
    municipalities_path = data_dir / "geojson-s0001" / "N03-21_210101.json"
    output_path = output_dir / "weather-data.json"

    # 観測所メタデータを読み込む（3種類を統合）
    print("観測所メタデータを読み込み中...")

    all_stations = []

    # 1. 気象官署（smaster.index）
    if smaster_path.exists():
        smaster_df = parse_smaster_index(smaster_path)
        print(f"  気象官署: {len(smaster_df)}件")
        all_stations.append(smaster_df)

    # 2. アメダス（ame_master）
    ame_files = list(jma_dir.glob("ame_master*.csv"))
    for ame_file in ame_files:
        ame_df = parse_amedas_master(ame_file)
        print(f"  アメダス ({ame_file.name}): {len(ame_df)}件")
        all_stations.append(ame_df)

    # 3. 積雪観測所（snow_master）
    snow_files = list(jma_dir.glob("snow_master*.csv"))
    for snow_file in snow_files:
        snow_df = parse_amedas_master(snow_file)
        print(f"  積雪観測所 ({snow_file.name}): {len(snow_df)}件")
        all_stations.append(snow_df)

    if not all_stations:
        print("エラー: 観測所メタデータが見つかりません。")
        return

    # 統合して重複を除去
    stations_df = pd.concat(all_stations, ignore_index=True)
    stations_df = stations_df.drop_duplicates(subset=["name"], keep="first")
    print(f"  統合後: {len(stations_df)}件")

    # 名前ルックアップを作成
    name_lookup = {
        row["name"]: (row["lat"], row["lon"]) for _, row in stations_df.iterrows()
    }

    # 気象データを読み込む
    print("\n気象データを読み込み中...")
    all_weather_data = []

    csv_files = list(jma_dir.glob("data*.csv"))
    for csv_file in csv_files:
        print(f"  処理中: {csv_file.name}")
        weather_df = parse_jma_weather_csv(csv_file)
        if not weather_df.empty:
            all_weather_data.append(weather_df)

    if not all_weather_data:
        print("エラー: 気象データが見つかりません。")
        return

    weather_df = pd.concat(all_weather_data, ignore_index=True)
    weather_df = (
        weather_df.groupby("station_name")
        .agg({"max_temp": "max", "max_snow": "max"})
        .reset_index()
    )

    # 生活圏の指標として不適切な山岳観測所を除外
    exclude_stations = ["富士山"]
    print(f"  除外対象の観測所: {exclude_stations}")
    weather_df = weather_df[~weather_df["station_name"].isin(exclude_stations)]

    print(f"  気象データ観測所数: {len(weather_df)}")

    # マッチング実行
    matched_data = []
    unmatched_names = []

    for _, row in weather_df.iterrows():
        station = row["station_name"]
        coord = None

        # 直接マッチ
        if station in name_lookup:
            coord = name_lookup[station]
        else:
            # 括弧を除去してマッチ
            clean_name = station.split("（")[0].split("(")[0].strip()
            if clean_name in name_lookup:
                coord = name_lookup[clean_name]

        if coord:
            matched_data.append(
                {
                    "station_name": station,
                    "max_temp": row["max_temp"],
                    "max_snow": row["max_snow"],
                    "lat": coord[0],
                    "lon": coord[1],
                }
            )
        else:
            unmatched_names.append(station)

    print(f"\n  マッチした観測所数: {len(matched_data)}")
    print(f"  マッチしなかった観測所数: {len(unmatched_names)}")

    if len(unmatched_names) > 0 and len(unmatched_names) <= 20:
        print(f"  マッチしなかった観測所: {unmatched_names}")

    if not matched_data:
        print("エラー: 観測所名のマッチングに失敗しました。")
        return

    matched_df = pd.DataFrame(matched_data)

    # GeoDataFrameに変換
    geometry = [
        Point(lon, lat) for lon, lat in zip(matched_df["lon"], matched_df["lat"])
    ]
    weather_gdf = gpd.GeoDataFrame(matched_df, geometry=geometry, crs="EPSG:4326")

    print("\n市区町村境界を読み込み中...")
    municipalities_gdf = gpd.read_file(municipalities_path)

    code_col = None
    for col in ["N03_007", "code", "id", "JCODE"]:
        if col in municipalities_gdf.columns:
            code_col = col
            break

    if code_col is None:
        print("エラー: 市区町村コードカラムが見つかりません。")
        return

    # 投影変換
    target_crs = "EPSG:32654"
    weather_gdf_proj = weather_gdf.to_crs(target_crs)
    municipalities_gdf_proj = municipalities_gdf.to_crs(target_crs)

    print("空間結合を実行中...")

    municipalities_gdf_proj["centroid"] = municipalities_gdf_proj.geometry.centroid
    centroids_gdf = municipalities_gdf_proj.set_geometry("centroid")

    # 気温データがある観測所のみでフィルター
    temp_gdf = weather_gdf_proj[weather_gdf_proj["max_temp"].notna()].copy()
    # 積雪データがある観測所のみでフィルター
    snow_gdf = weather_gdf_proj[weather_gdf_proj["max_snow"].notna()].copy()

    print(f"  気温データ観測所: {len(temp_gdf)}件")
    print(f"  積雪データ観測所: {len(snow_gdf)}件")

    # 気温データ用の空間結合
    result_temp = gpd.sjoin_nearest(
        centroids_gdf[[code_col, "centroid"]].set_geometry("centroid"),
        temp_gdf[["station_name", "max_temp", "geometry"]],
        how="left",
        distance_col="distance_temp",
    )

    # 積雪データ用の空間結合
    result_snow = gpd.sjoin_nearest(
        centroids_gdf[[code_col, "centroid"]].set_geometry("centroid"),
        snow_gdf[["station_name", "max_snow", "geometry"]],
        how="left",
        distance_col="distance_snow",
    )

    # 結果を統合
    weather_data = {}
    for idx, row in result_temp.iterrows():
        code = str(row[code_col])
        if len(code) < 5:
            code = code.zfill(5)

        weather_data[code] = {
            "max_temp": round(row["max_temp"], 1)
            if pd.notna(row["max_temp"])
            else None,
            "max_snow": None,  # 後で上書き
            "station_temp": row["station_name"]
            if pd.notna(row["station_name"])
            else None,
            "station_snow": None,  # 後で上書き
        }

    for idx, row in result_snow.iterrows():
        code = str(row[code_col])
        if len(code) < 5:
            code = code.zfill(5)

        if code in weather_data:
            weather_data[code]["max_snow"] = (
                int(row["max_snow"]) if pd.notna(row["max_snow"]) else None
            )
            weather_data[code]["station_snow"] = (
                row["station_name"] if pd.notna(row["station_name"]) else None
            )

    # station フィールドを追加（互換性のため、気温観測所を優先）
    for code, data in weather_data.items():
        data["station"] = data.get("station_temp") or data.get("station_snow")
        # 不要なフィールドを削除
        del data["station_temp"]
        del data["station_snow"]

    with open(output_path, "w", encoding="utf-8") as f:
        json.dump(weather_data, f, ensure_ascii=False, indent=2)

    print(f"\n処理完了: {output_path}")
    print(f"対象市区町村数: {len(weather_data)}")

    temps = [v["max_temp"] for v in weather_data.values() if v["max_temp"] is not None]
    snows = [v["max_snow"] for v in weather_data.values() if v["max_snow"] is not None]

    if temps:
        print(f"最高気温範囲: {min(temps):.1f}℃ - {max(temps):.1f}℃")
        print(f"最高気温データあり: {len(temps)}件")
    if snows:
        print(f"最深積雪範囲: {min(snows)}cm - {max(snows)}cm")
        print(f"最深積雪データあり: {len(snows)}件")


if __name__ == "__main__":
    main()
