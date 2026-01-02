# データ準備ガイド

このドキュメントでは、都会度マップのデータを準備する手順を説明します。

## 前提条件

- Python 3.11以上
- [uv](https://github.com/astral-sh/uv)（Pythonパッケージマネージャー）
- 十分なディスク容量（約6GB以上）

## データディレクトリ構成

```
urbanity-map/
├── data/                          # ソースデータ（Gitに含まれない、約5.9GB）
│   ├── japan-latest.osm.pbf      # OpenStreetMapデータ
│   ├── population_mesh/          # 人口メッシュデータ
│   ├── geojson-s0001/            # 市区町村境界データ
│   └── night_lights/             # 夜間光データ
└── frontend/public/data/          # 処理済みデータ（Gitに含まれる、約13MB）
    ├── japan-with-scores-v2.geojson  # スコア付き市区町村境界
    ├── urbanity-score-v2.json        # 統合スコアJSON
    └── その他のスコアファイル
```

## データ準備手順

### 1. 必要なソースデータのダウンロード

#### 1.1 市区町村境界データ
```bash
# 国土数値情報から市区町村境界データをダウンロード
# https://nlftp.mlit.go.jp/ksj/gml/datalist/KsjTmplt-N03-2021.html
# ダウンロード後、以下に配置：
# data/geojson-s0001/N03-21_210101.json
```

#### 1.2 夜間光データ
```bash
# VIIRS Night Lightsデータをダウンロード
# 配置先: data/night_lights/
```

#### 1.3 人口メッシュデータ
```bash
# e-Statから500mメッシュ人口データをダウンロード
# https://www.e-stat.go.jp/
# 配置先: data/population_mesh/
```

#### 1.4 OpenStreetMapデータ（POI用）
```bash
# Geofabrikから日本のOSMデータをダウンロード
cd data
wget https://download.geofabrik.de/asia/japan-latest.osm.pbf
```

### 2. スコアの算出

各スクリプトを順番に実行してスコアを算出します。

#### 2.1 夜間光スコアの算出
```bash
cd scripts
uv run process_night_lights.py
```

出力: `frontend/public/data/urbanity-score.json`

#### 2.2 人口スコアの算出
```bash
uv run process_population.py
```

出力: `frontend/public/data/population-score.json`

#### 2.3 POIスコアの算出
```bash
uv run process_poi.py
```

出力: `frontend/public/data/poi-score.json`

#### 2.4 統合スコアの算出
```bash
uv run integrate_scores.py
```

出力:
- `frontend/public/data/urbanity-score-v2.json` - 統合スコアJSON
- `frontend/public/data/japan-with-scores-v2.geojson` - スコア付きGeoJSON

### 3. データの確認

```bash
# 生成されたファイルを確認
ls -lh frontend/public/data/

# 統合スコアの内容を確認
head frontend/public/data/urbanity-score-v2.json
```

## スコアの構成

統合スコア（`urbanity-score-v2.json`）には以下のスコアが含まれます：

- **urbanity**: 統合都会度スコア（夜間光40% + 人口30% + POI30%）
- **light_pollution**: 光害度スコア（夜間光スコアそのまま）
- **night_light**: 夜間光スコア
- **population**: 人口スコア
- **poi**: POIスコア

すべてのスコアは0-100の範囲で正規化されています。

## トラブルシューティング

### データが見つからないエラー
各スクリプトは前のステップで生成されたデータに依存します。エラーが出た場合は、前のステップが正しく完了しているか確認してください。

### メモリ不足エラー
大きなデータファイルを処理する際にメモリ不足になる場合は、処理を分割するか、より多くのメモリを持つマシンで実行してください。

### キャッシュの利用
`process_poi.py`はキャッシュ機能を持っています。再実行時は以前の結果を再利用して高速化されます。

## 注意事項

- `data/`ディレクトリは`.gitignore`に含まれており、Gitリポジトリには含まれません
- `frontend/public/data/`の処理済みデータはGitに含まれます
- ソースデータは必要に応じて再ダウンロード・再生成してください
