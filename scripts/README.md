# データ処理スクリプト

都会度マップのデータを処理するPythonスクリプト集です。

## 概要

このディレクトリには、ソースデータから都会度・光害スコアを算出するスクリプトが含まれています。

## 前提条件

- Python 3.11以上
- [uv](https://github.com/astral-sh/uv) - Pythonパッケージマネージャー

## スクリプト一覧

### 1. `process_night_lights.py`
夜間光データから光害スコアを算出します。

```bash
cd scripts
uv run process_night_lights.py
```

**出力**: `frontend/public/data/urbanity-score.json`

### 2. `process_population.py`
国勢調査データ（Excel）から市区町村別人口を抽出し、人口スコアを算出します。
以前のメッシュデータ版から、より正確な国勢調査データ版に移行されました。

```bash
uv run process_population.py
```

**出力**: `frontend/public/data/population-score.json`, `frontend/public/data/population-data.json`

### 3. `process_poi.py`
OpenStreetMapデータからPOI（施設）スコアを算出します。

```bash
uv run process_poi.py
```

**出力**: `frontend/public/data/poi-score.json`, `frontend/public/data/poi-data.json`

### 4. `process_land_price.py`
地価公示データから市区町村別の地価中央値を算出します。

```bash
uv run process_land_price.py
```

**出力**: `frontend/public/data/land_price.json`

### 5. `process_demographics.py`
国勢調査データから人口増加率・高齢者割合を算出します。

```bash
uv run process_demographics.py
```

**出力**: `frontend/public/data/demographics.json`

### 6. `process_tax.py`
課税所得データから1人当たり課税所得を算出します。
区ごとのデータがない政令指定都市の場合、市のデータで補完する処理が含まれています。

```bash
uv run process_tax.py
```

**出力**: `frontend/public/data/tax_income.json`

### 7. `integrate_scores.py`
4層のスコアを統合して最終的な都会度スコアを算出します。

```bash
uv run integrate_scores.py
```

**出力**:
- `frontend/public/data/urbanity-score-v2.json` - 統合スコアJSON
- `frontend/public/data/japan-with-scores-v2.geojson` - スコア付きGeoJSON

**統合方法**:
PCA（主成分分析）を用いてデータ分散に基づき動的に重みを算出：
- **入力**: 夜間光・人口・POI・地価
- **対数変換**: 分布の偏りを緩和するため、各変数に対数変換 `log(x + 1)` を適用
- **PCA**: 対数変換後の4変数から第一主成分・重みを抽出
- **重み**: 夜間光:0.26, 人口:0.23, POI:0.26, 地価:0.24

### 8. `generate_prefecture_borders.py`
市区町村データから都道府県境界データを生成します。

```bash
uv run generate_prefecture_borders.py
```

**出力**: `frontend/public/data/prefectures.geojson`

## 実行順序

スクリプトは以下の順序で実行してください：

1. `process_night_lights.py` ← 必須
2. `process_population.py`
3. `process_poi.py`
4. `process_land_price.py`
5. `process_demographics.py`
6. `process_tax.py`
7. `integrate_scores.py` ← 最終統合
8. `generate_prefecture_borders.py`

## データ準備

詳細なデータ準備手順については、[データ準備ガイド](../docs/DATA_PREPARATION.md)を参照してください。

## 依存関係

主な依存パッケージ：
- `geopandas` - 地理空間データ処理
- `rasterio` - ラスターデータ処理
- `osmium` - OpenStreetMapデータ処理
- `numpy` - 数値計算
- `shapely` - 幾何演算

依存関係は `pyproject.toml` で管理されています。

## トラブルシューティング

### データが見つからないエラー
前のステップのスクリプトが正しく実行されているか確認してください。

### メモリ不足
大きなデータファイルを処理する際は、十分なメモリ（8GB以上推奨）が必要です。

### キャッシュのクリア
`process_poi.py`のキャッシュをクリアする場合は、キャッシュファイルを削除してください。