"""OSMデータからPOIを抽出して店舗密度スコアを算出するスクリプト (pyosmium版)

OpenStreetMapデータ(.osm.pbf)からコンビニ・スーパー・飲食店を抽出し、
市区町村ごとの密度（面積あたりの店舗数）を算出します。
osmiumライブラリを使用するため、外部コマンド(osmium-tool)は不要です。

使用方法:
    cd scripts
    uv run process_poi.py
"""

import json
import sys
import warnings
from pathlib import Path

import geopandas as gpd
import numpy as np
import numpy.typing as npt
import pandas as pd
import osmium
from shapely.geometry import Point

# CRS変換などの警告を抑制
warnings.filterwarnings('ignore')

# ターゲットとするPOIのタグ
TARGET_TAGS = {
    'shop': ['convenience', 'supermarket'],
    'amenity': ['restaurant', 'cafe', 'fast_food', 'bar', 'pub', 'izakaya']
}

class POIHandler(osmium.SimpleHandler):
    def __init__(self):
        super(POIHandler, self).__init__()
        self.pois = []
        self.count = 0

    def _is_target(self, tags):
        if 'shop' in tags and tags['shop'] in TARGET_TAGS['shop']:
            return True
        if 'amenity' in tags and tags['amenity'] in TARGET_TAGS['amenity']:
            return True
        return False

    def node(self, n):
        if self._is_target(n.tags):
            self.pois.append({
                'id': n.id,
                'lat': n.location.lat,
                'lon': n.location.lon
            })
            self.count += 1
            if self.count % 10000 == 0:
                print(f"\r抽出済みPOI数: {self.count}", end="")

    # Way処理はメモリ消費が激しいため削除 (Nodeのみ抽出)
    # def way(self, w): ...


def main() -> None:
    # パス設定
    script_dir: Path = Path(__file__).parent
    data_dir: Path = script_dir.parent / "data"
    output_dir: Path = script_dir.parent / "frontend" / "public" / "data"

    osm_pbf_path: Path = data_dir / "japan-latest.osm.pbf"
    municipalities_path: Path = data_dir / "geojson-s0001" / "N03-21_210101.json"
    poi_cache_path: Path = data_dir / "interm_poi.parquet"
    output_path: Path = output_dir / "poi-score.json"

    # 出力ディレクトリが存在しない場合は作成
    output_dir.mkdir(parents=True, exist_ok=True)

    df: pd.DataFrame
    if poi_cache_path.exists():
        print(f"キャッシュされたPOIデータを使用します: {poi_cache_path}")
        df = pd.read_parquet(poi_cache_path)
    else:
        if not osm_pbf_path.exists():
            print(f"エラー: OSMデータが見つかりません: {osm_pbf_path}")
            print("Geofabrikから japan-latest.osm.pbf をダウンロードして data/ に配置してください。")
            sys.exit(1)

        print(f"OSMデータ読み込み処理開始: {osm_pbf_path}")
        print("これには数分かかる場合があります...")
        print("※メモリ不足回避のため、地点データ(Node)のみを抽出します")
    
        handler = POIHandler()
        try:
            # locations=True を削除してメモリ節約
            handler.apply_file(str(osm_pbf_path))
        except Exception as e:
            print(f"\nエラー: OSM処理中に例外が発生しました: {e}")
            sys.exit(1)
        
        print(f"\nPOI抽出完了: {len(handler.pois)} 件")
    
        if not handler.pois:
            print("警告: POIが見つかりませんでした。")
            sys.exit(1)

        # DataFrame化
        df = pd.DataFrame(handler.pois)
        
        # キャッシュ保存
        print(f"POIデータをキャッシュに保存中: {poi_cache_path}")
        df.to_parquet(poi_cache_path, index=False)
    
    # GeoDataFrame化
    print("空間データ変換中...")
    geometry = [Point(xy) for xy in zip(df.lon, df.lat)]
    poi_gdf = gpd.GeoDataFrame(df, geometry=geometry, crs="EPSG:4326")

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
    
    # 投影変換（面積計算のため平面直角座標系へ）
    # 日本全体をカバーするためJGD2011 (EPSG:6668) -> 平面直角は地域によるが、
    # 簡易的にUTM54N (EPSG:32654) または 3857 (Web Mercator) を使用
    # 面積計算には等積投影が良いが、3857でも近似値としては使える（緯度による歪みはある）
    # 厳密には地域ごとにJGD2011平面直角座標系を選択すべきだが、全国一括なので
    # 'EPSG:3005' (JGD2000 / UTM zone 54N) 等を使用
    target_crs = "EPSG:3005" # JGD2000 / UTM zone 54N

    print(f"投影変換 ({target_crs})...")
    poi_gdf = poi_gdf.to_crs(target_crs)
    municipalities_gdf = municipalities_gdf.to_crs(target_crs)

    # 面積計算 (km2)
    municipalities_gdf['area_km2'] = municipalities_gdf.geometry.area / 10**6

    print("空間結合を実行中...")
    # インデックスを使用
    joined: gpd.GeoDataFrame = gpd.sjoin(
        poi_gdf,
        municipalities_gdf[[code_col, 'geometry']],
        how='inner',
        predicate='within'
    )

    print("集計中...")
    counts = joined.groupby(code_col).size().reset_index(name='poi_count')
    
    # 面積データとマージ
    merged = municipalities_gdf[[code_col, 'area_km2']].merge(counts, on=code_col, how='left').fillna(0)
    merged['poi_count'] = merged['poi_count'].astype(int)

    # 密度算出 (店舗数 / km2)
    merged['density'] = merged['poi_count'] / merged['area_km2']
    # 面積0の除算回避
    merged['density'] = merged['density'].fillna(0)
    merged.loc[merged['area_km2'] <= 0, 'density'] = 0

    # スコア算出 logic (対数正規化)
    print("POIスコアを算出中...")
    density_values: npt.NDArray[np.float64] = merged['density'].values.astype(np.float64)
    # log(0)回避
    density_values = np.where(density_values > 0, density_values, 0.001)
    log_density: npt.NDArray[np.float64] = np.log10(density_values + 1) # +1? or just log10? log(density) can be negative.
    # density can be < 1. log10(0.1) = -1.
    # log10(density + 1) guarantees >= 0.

    min_val: float = float(log_density.min())
    max_val: float = float(log_density.max())

    normalized: npt.NDArray[np.float64]
    if max_val > min_val:
        normalized = ((log_density - min_val) / (max_val - min_val) * 100).round(1)
    else:
        normalized = np.zeros_like(log_density)

    merged['score'] = normalized

    # 結果保存
    result: dict[str, float] = {}
    for _, row in merged.iterrows():
        code: str = str(row[code_col])
        if len(code) < 5:
            code = code.zfill(5)
        result[code] = float(row['score'])

    with open(output_path, 'w', encoding='utf-8') as f:
        json.dump(result, f, ensure_ascii=False, indent=2)

    print(f"処理完了: {output_path}")
    print(f"対象市区町村数: {len(result)}")
    print(f"最大密度: {merged['density'].max():.2f} 店舗/km2")

if __name__ == "__main__":
    main()
