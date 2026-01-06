"""データ割り当て検証テスト

地価・課税所得・気象データなどが、正しい市区町村に割り当てられていることを検証します。

使用方法:
    cd scripts
    uv run pytest tests/test_data_assignment.py -v
"""

import json
from pathlib import Path

import pytest

# テストデータのパス設定
SCRIPT_DIR = Path(__file__).parent.parent  # scripts/
DATA_DIR = SCRIPT_DIR.parent / "frontend" / "public" / "data"


@pytest.fixture(scope="module")
def land_price_data() -> dict[str, int]:
    """地価データを読み込むフィクスチャ"""
    path = DATA_DIR / "land_price.json"
    if not path.exists():
        pytest.skip(f"地価データファイルが見つかりません: {path}")
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture(scope="module")
def tax_income_data() -> dict[str, int]:
    """課税所得データを読み込むフィクスチャ"""
    path = DATA_DIR / "tax_income.json"
    if not path.exists():
        pytest.skip(f"課税所得データファイルが見つかりません: {path}")
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture(scope="module")
def weather_data() -> dict[str, dict]:
    """気象データを読み込むフィクスチャ"""
    path = DATA_DIR / "weather-data.json"
    if not path.exists():
        pytest.skip(f"気象データファイルが見つかりません: {path}")
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


@pytest.fixture(scope="module")
def geojson_data() -> dict:
    """GeoJSONデータを読み込むフィクスチャ"""
    path = DATA_DIR / "japan-with-scores-v2.geojson"
    if not path.exists():
        pytest.skip(f"GeoJSONファイルが見つかりません: {path}")
    with open(path, "r", encoding="utf-8") as f:
        return json.load(f)


# =============================================================================
# 既知データ検証テスト
# =============================================================================


class TestKnownMunicipalities:
    """代表的な市区町村のデータが公開情報と一致することを確認"""

    def test_minato_ku_avg_income(self, tax_income_data: dict[str, int]):
        """港区（13103）の平均所得が高いことを確認"""
        # 港区は全国でもトップクラスの平均所得を誇る
        minato_income = tax_income_data.get("13103")
        assert minato_income is not None, "港区のデータが存在しません"
        # 港区の平均所得は約1,100万円以上（2023年データ基準）
        assert minato_income >= 10_000_000, (
            f"港区の平均所得が低すぎます: {minato_income:,}円"
        )
        # 極端に高すぎないことも確認
        assert minato_income <= 15_000_000, (
            f"港区の平均所得が高すぎます: {minato_income:,}円"
        )

    def test_chiyoda_ku_land_price(self, land_price_data: dict[str, int]):
        """千代田区（13101）の地価が高いことを確認"""
        # 千代田区は日本で最も地価が高いエリアの一つ
        chiyoda_price = land_price_data.get("13101")
        assert chiyoda_price is not None, "千代田区のデータが存在しません"
        # 千代田区の平均地価は200万円/㎡以上
        assert chiyoda_price >= 2_000_000, (
            f"千代田区の地価が低すぎます: {chiyoda_price:,}円/㎡"
        )

    def test_shibuya_ku_land_price(self, land_price_data: dict[str, int]):
        """渋谷区（13113）の地価が高いことを確認"""
        shibuya_price = land_price_data.get("13113")
        assert shibuya_price is not None, "渋谷区のデータが存在しません"
        # 渋谷区の平均地価は100万円/㎡以上
        assert shibuya_price >= 1_000_000, (
            f"渋谷区の地価が低すぎます: {shibuya_price:,}円/㎡"
        )

    def test_okinawa_no_snow(self, weather_data: dict[str, dict]):
        """沖縄県の市町村（47xxx）は積雪がほぼないことを確認（稀な積雪を許容）"""
        okinawa_codes = [code for code in weather_data.keys() if code.startswith("47")]
        if not okinawa_codes:
            pytest.skip("沖縄県のデータがありません")

        for code in okinawa_codes[:5]:  # 最初の5件をサンプルチェック
            data = weather_data[code]
            if "max_snow" in data:
                # 沖縄でも稀に積雪がある（2016年に名護で積雪を観測）
                # 10cm以下であれば許容
                assert data["max_snow"] <= 10, (
                    f"沖縄県({code})の積雪が多すぎます: {data['max_snow']}cm"
                )

    def test_hokkaido_has_snow(self, weather_data: dict[str, dict]):
        """北海道の市町村（01xxx）は積雪があることを確認"""
        # 札幌市中央区（01101）をチェック
        sapporo_data = weather_data.get("01101")
        if sapporo_data is None:
            pytest.skip("札幌市のデータがありません")

        if "max_snow" in sapporo_data:
            assert sapporo_data["max_snow"] > 50, (
                f"札幌市の積雪が少なすぎます: {sapporo_data['max_snow']}cm"
            )


# =============================================================================
# 地理的整合性検証テスト
# =============================================================================


class TestGeographicConsistency:
    """隣接する市区町村間でデータに極端な断絶がないことを確認"""

    def test_tokyo_23ku_land_price_consistency(self, land_price_data: dict[str, int]):
        """東京23区内の地価が極端に異なりすぎないことを確認"""
        tokyo_23ku = [f"131{str(i).zfill(2)}" for i in range(1, 24)]  # 13101～13123
        prices = []
        for code in tokyo_23ku:
            price = land_price_data.get(code)
            if price is not None:
                prices.append(price)

        if len(prices) < 10:
            pytest.skip("東京23区のデータが不足しています")

        min_price = min(prices)
        max_price = max(prices)
        # 23区内で100倍以上の差があるのは異常
        ratio = max_price / min_price if min_price > 0 else float("inf")
        assert ratio < 100, (
            f"東京23区内で地価の差が大きすぎます: 最大{max_price:,}円 / 最小{min_price:,}円 = {ratio:.1f}倍"
        )

    def test_osaka_city_land_price_consistency(self, land_price_data: dict[str, int]):
        """大阪市内の区の地価が極端に異なりすぎないことを確認"""
        # 大阪市の区コード: 27101～27128
        osaka_wards = [f"271{str(i).zfill(2)}" for i in range(1, 29)]
        prices = []
        for code in osaka_wards:
            price = land_price_data.get(code)
            if price is not None:
                prices.append(price)

        if len(prices) < 5:
            pytest.skip("大阪市のデータが不足しています")

        min_price = min(prices)
        max_price = max(prices)
        ratio = max_price / min_price if min_price > 0 else float("inf")
        assert ratio < 50, f"大阪市内で地価の差が大きすぎます: {ratio:.1f}倍"


# =============================================================================
# データカバレッジ検証テスト
# =============================================================================


class TestDataCoverage:
    """データの網羅率を確認"""

    def test_geojson_has_urbanity_score(self, geojson_data: dict):
        """GeoJSONの全featureに都会度スコアが存在することを確認"""
        features = geojson_data.get("features", [])
        missing_count = 0
        for feature in features:
            props = feature.get("properties", {})
            if props.get("urbanity_v2") is None:
                missing_count += 1

        coverage = (
            (len(features) - missing_count) / len(features) * 100 if features else 0
        )
        assert coverage >= 95, f"都会度スコアのカバレッジが低すぎます: {coverage:.1f}%"

    def test_geojson_has_population(self, geojson_data: dict):
        """GeoJSONの全featureに人口データが存在することを確認"""
        features = geojson_data.get("features", [])
        missing_count = 0
        for feature in features:
            props = feature.get("properties", {})
            if (
                props.get("population_count") is None
                or props.get("population_count") == 0
            ):
                missing_count += 1

        coverage = (
            (len(features) - missing_count) / len(features) * 100 if features else 0
        )
        assert coverage >= 90, f"人口データのカバレッジが低すぎます: {coverage:.1f}%"


# =============================================================================
# コード形式検証テスト
# =============================================================================


class TestCodeFormat:
    """市区町村コードの形式を確認"""

    def test_land_price_code_format(self, land_price_data: dict[str, int]):
        """地価データのコードが5桁であることを確認"""
        for code in land_price_data.keys():
            assert len(code) == 5, f"不正なコード長: {code} ({len(code)}桁)"
            assert code.isdigit(), f"非数値文字を含むコード: {code}"

    def test_tax_income_code_format(self, tax_income_data: dict[str, int]):
        """課税所得データのコードが5桁であることを確認"""
        for code in tax_income_data.keys():
            assert len(code) == 5, f"不正なコード長: {code} ({len(code)}桁)"
            assert code.isdigit(), f"非数値文字を含むコード: {code}"

    def test_weather_code_format(self, weather_data: dict[str, dict]):
        """気象データのコードが5桁であることを確認（不正コードは警告）"""
        invalid_codes = []
        for code in weather_data.keys():
            if len(code) != 5 or not code.isdigit():
                invalid_codes.append(code)

        # 不正なコードが全体の1%未満であれば許容（警告として出力）
        invalid_ratio = len(invalid_codes) / len(weather_data) if weather_data else 0
        if invalid_codes:
            print(f"\n警告: 不正なコードを検出: {invalid_codes[:10]}...")
        assert invalid_ratio < 0.01, (
            f"不正なコードが多すぎます: {len(invalid_codes)}件 ({invalid_ratio * 100:.1f}%)"
        )

    def test_geojson_code_format(self, geojson_data: dict):
        """GeoJSONのN03_007コードが5桁であることを確認"""
        features = geojson_data.get("features", [])
        for feature in features[:100]:  # パフォーマンスのため最初の100件
            props = feature.get("properties", {})
            code = props.get("N03_007")
            if code:
                assert len(str(code)) == 5, f"不正なコード長: {code}"
