# データ処理スクリプト

都会度マップのデータを処理するPythonスクリプト集です。

## 概要

このディレクトリには、ソースデータから都会度・光害スコアを算出するスクリプトが含まれています。

## 前提条件

- Python 3.11以上
- [uv](https://github.com/astral-sh/uv) - Pythonパッケージマネージャー

## スクリプト一覧

### 0. `download_census_2025.py` と `prepare_municipality_boundaries.py`
e-Statの2025年国勢調査Excelをチェックサム検証付きで取得し、国土数値情報の
2025年市区町村境界を国勢調査コードとの照合用に自治体コード単位に整形します。

```bash
uv run python download_census_2025.py --with-boundaries
uv run python prepare_municipality_boundaries.py
```

**出力**: `data/census_2025/`, `data/geojson-s0001/N03-25_250101.json`

地図形状は全国で2020年境界を維持します。浜松市は2025年の新3区の内部分割を使い、区境は周辺の2020年境界と同程度の頂点密度になるよう簡略化します。外周は2020年の浜松市全体の形状を維持します。
平均所得は区別データがないため浜松市全体の値を3区共通で表示し、その旨を画面に明記します。
地価は旧7区の値を無理に按分せず、新3区の地点データから再集計します。

### 1. `process_night_lights.py`
夜間光データから光害スコアを算出します。

```bash
cd scripts
uv run process_night_lights.py
```

**出力**: `frontend/public/data/urbanity-score.json`

人口スコアと同様、正規化範囲は `urbanity-calibration-v2.json` の2020年基準に固定されます。

### 2. `process_population.py`
2025年国勢調査・人口等基本集計 表1-1から市区町村別人口を抽出し、人口スコアを算出します。

```bash
uv run process_population.py
```

**出力**: `frontend/public/data/population-score.json`, `frontend/public/data/population-data.json`

### 3. `process_poi.py`
OpenStreetMapデータからPOI（施設）スコアを算出します。
この出力は補助データで、現在の統合スコアでは経済センサスの事業所数を使用します。

```bash
uv run process_poi.py
```

**出力**: `frontend/public/data/poi-score.json`, `frontend/public/data/poi-data.json`

### 4. `process_land_price.py`
国土数値情報の2026年地価公示（標準地ポイント）から、市区町村別の平均公示地価を算出します。

```bash
uv run process_land_price.py
```

**出力**: `frontend/public/data/land_price.json`

入力: `data/L01-26_GML/L01-26.geojson`（2026年1月1日時点、価格属性 `L01_008`、円/㎡）

### 5. `process_demographics.py`
2025年国勢調査の人口増減率と65歳以上割合を算出します。

```bash
uv run process_demographics.py
```

**出力**: `frontend/public/data/demographics.json`

### 6. `process_tax.py`
総務省「市町村税課税状況等の調」令和7年度 第11表（`data/J51-25-b.xlsx`）から、
`総所得金額等 ÷ 所得割の納税義務者数` を算出します。これは2024年所得の納税義務者
1人当たりの平均所得で、課税対象所得や給与年収とは異なります。区別データがない
政令指定都市は市全体の値で補完し、浜松市の新3区も同じ方法で補完します。

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
2020年版で学習したPCAモデルを固定して適用します。データ更新時に標準化係数・重み・スコア範囲を再計算しません。
- **入力**: 夜間光・人口・経済センサス事業所数・地価
- **対数変換**: 分布の偏りを緩和するため、各変数に対数変換 `log(x + 1)` を適用
- **PCA**: 保存済みの第一主成分を適用
- **基準ファイル**: `urbanity-calibration-v2.json`（2020年版の正規化範囲・標準化係数・PCA係数・最終スコア範囲）
- **固定重み**: 夜間光:0.28, 人口:0.27, 事業所数:0.16, 地価:0.29

### 8. `generate_prefecture_borders.py`
2020年市区町村データから、従来表示と同じ都道府県境界データを生成します。

```bash
uv run generate_prefecture_borders.py
```

**出力**: `frontend/public/data/prefectures.geojson`

## 実行順序

スクリプトは以下の順序で実行してください：

1. `download_census_2025.py --with-boundaries`
2. `prepare_municipality_boundaries.py`
3. `process_night_lights.py`
4. `process_population.py`
5. `process_poi.py`
6. `process_land_price.py`
7. `process_demographics.py`
8. `process_tax.py`
9. `integrate_scores.py` ← 最終統合
10. `generate_prefecture_borders.py`

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
