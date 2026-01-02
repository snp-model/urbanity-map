# データ処理スクリプト

都会度マップのデータを処理するPythonスクリプト集です。

## 概要

このディレクトリには、ソースデータから都会度・光害度スコアを算出するスクリプトが含まれています。

## 前提条件

- Python 3.11以上
- [uv](https://github.com/astral-sh/uv) - Pythonパッケージマネージャー

## スクリプト一覧

### 1. `process_night_lights.py`
夜間光データから光害度スコアを算出します。

```bash
cd scripts
uv run process_night_lights.py
```

**出力**: `frontend/public/data/urbanity-score.json`

### 2. `process_population.py`
人口メッシュデータから人口スコアを算出します。

```bash
uv run process_population.py
```

**出力**: `frontend/public/data/population-score.json`

### 3. `process_poi.py`
OpenStreetMapデータからPOI（施設）スコアを算出します。

```bash
uv run process_poi.py
```

**出力**: `frontend/public/data/poi-score.json`

**特徴**:
- キャッシュ機能により2回目以降の実行が高速化
- 施設カテゴリごとに重み付けを実施

### 4. `integrate_scores.py`
3層のスコアを統合して最終的な都会度スコアを算出します。

```bash
uv run integrate_scores.py
```

**出力**:
- `frontend/public/data/urbanity-score-v2.json` - 統合スコアJSON
- `frontend/public/data/japan-with-scores-v2.geojson` - スコア付きGeoJSON

**統合方法**:
- 夜間光: 40%
- 人口: 30%
- POI: 30%

## 実行順序

スクリプトは以下の順序で実行してください：

1. `process_night_lights.py` ← 必須
2. `process_population.py`
3. `process_poi.py`
4. `integrate_scores.py` ← 最終統合

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
