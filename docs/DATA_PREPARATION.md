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
│   ├── census_2025/              # e-Stat 2025年国勢調査Excel
│   ├── geojson-s0001/            # 国土数値情報 2020/2025年市区町村境界
│   ├── L01-26_GML/                # 国土数値情報 2026年地価公示
│   └── night_lights/             # 夜間光データ
└── frontend/public/data/          # 処理済みデータ（Gitに含まれる、約13MB）
    ├── japan-with-scores-v2.geojson  # スコア付き市区町村境界
    ├── prefectures.geojson           # 県境データ
    ├── urbanity-score-v2.json        # 統合スコアJSON
    └── その他のスコアファイル
```

## データ準備手順

### 1. 必要なソースデータのダウンロード

#### 1.1 2025年国勢調査・市区町村境界
```bash
cd scripts
uv run python download_census_2025.py --with-boundaries
uv run python prepare_municipality_boundaries.py
```

e-Statの表1-1（人口・5年間の増減率）と表2-7（年齢別人口）を
ファイルID固定で取得し、SHA-256を検証します。`--with-boundaries` は国土数値情報の
全国境界アーカイブ（約600MB）も取得・展開します。境界データは市区町村コード単位に
結合・簡略化され、`data/geojson-s0001/N03-25_250101.json` に生成されます。
国勢調査の地域コードは境界形状1,905件のうち1,892件に一致します。残り13件は
調査対象外の島しょ部または所属未定地で、形状は残し、国勢調査値は欠損として扱います。
この2025年境界は国勢調査コードとの照合に使います。地図形状は全国で従来の2020年境界を
維持します。区再編のあった浜松市は2025年の新3区の内部分割を使い、区境は周辺の2020年境界と同程度の頂点密度に簡略化します。周辺自治体との接合を保つため、外周は2020年の浜松市全体の形状に合わせます。

#### 1.2 夜間光データ
```bash
# VIIRS Night Lightsデータをダウンロード
# 配置先: data/night_lights/
```

#### 1.3 OpenStreetMapデータ（POI用）
```bash
# Geofabrikから日本のOSMデータをダウンロード
cd data
wget https://download.geofabrik.de/asia/japan-latest.osm.pbf
```

#### 1.4 その他の統計データ
- 地価公示データ: 国土数値情報 2026年版（`data/L01-26_GML/L01-26.geojson`）
- 平均所得データ: 総務省「市町村税課税状況等の調」令和7年度 第11表
  （[公式ページ](https://www.soumu.go.jp/main_sosiki/jichi_zeisei/czaisei/czaisei_seido/ichiran09_25.html)、
  Excel `J51-25-b.xlsx` を `data/` に配置）

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
※`download_census_2025.py` が取得した表1-1（2025年人口）を使用します。

出力: `frontend/public/data/population-score.json`, `frontend/public/data/population-data.json`

#### 2.3 POIスコアの算出
```bash
uv run process_poi.py
```

出力: `frontend/public/data/poi-score.json`

#### 2.4 各種統計データの処理
```bash
uv run process_land_price.py
uv run process_demographics.py
uv run process_tax.py
```
出力:
- `land_price.json`
- `demographics.json`
- `tax_income.json`

`process_demographics.py` は表1-1の公式5年間人口増減率と、表2-7の「65歳以上」再掲値を使います。
このため、従来の2015–2020年増減率・2020年年齢表とは基準年が異なります。
`process_tax.py` は令和7年度第11表の「総所得金額等」を「所得割の納税義務者数」で割ります。
年度表記は令和7年度ですが、対象となる所得は2024年分です。課税対象所得や給与年収ではありません。

#### 2.5 統合スコアの算出
```bash
uv run integrate_scores.py
```

統合GeoJSONは `N03-21_210101.json` を基準にし、浜松市の旧7区だけを公式の2025年新3区形状に
置き換えます。新3区の内部境界は周辺の市町境界と同程度の頂点密度にトポロジーを保って簡略化し、外周は2020年の旧7区の合併形状に合わせます。
平均所得は区別値がないため浜松市全体値を3区共通で表示し、画面にも注記します。
地価は2026年の標準地ポイント（`L01_008`、円/㎡）から市区町村別の平均値を再集計します。
`data/L01-26_GML/L01-26.geojson` が未配置の場合は
欠損表示にし、旧7区の数値から推定しません。

出力:
- `frontend/public/data/urbanity-score-v2.json` - 統合スコアJSON
- `frontend/public/data/japan-with-scores-v2.geojson` - スコア付きGeoJSON

#### 2.6 県境データの生成
```bash
uv run generate_prefecture_borders.py
```
入力には2020年境界を使い、市区町村形状とのずれを避けます。
出力: `frontend/public/data/prefectures.geojson`

### 3. データの確認

```bash
# 生成されたファイルを確認
ls -lh frontend/public/data/

# 統合スコアの内容を確認
head frontend/public/data/urbanity-score-v2.json
```

## スコアの構成

統合スコア（`urbanity-score-v2.json`）には以下のスコアが含まれます：

- **urbanity**: 統合都会度スコア（夜間光 + 人口 + 経済センサス事業所数 + 地価のPCA算出値）
- **light_pollution**: 光害スコア（夜間光スコアそのまま）
- **night_light**: 夜間光スコア
- **population**: 人口スコア
- **establishment_count**: 経済センサス事業所数
- **avg_income**: 平均所得
- **land_price**: 地価
- その他統計値

すべてのスコアは0-100の範囲で正規化されています（統計値を除く）。

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
