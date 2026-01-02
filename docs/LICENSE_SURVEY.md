# ライセンスおよび権利関係の調査報告

本プロジェクトで使用されているデータおよび主要ライブラリのライセンス、商用利用の可否、および表記義務について調査しました。

## 1. データソース

全てのデータソースにおいて**商用利用は可能**ですが、**適切な出典の明記**が必須です。
特にOpenStreetMap (OSM) データを使用しているため、生成されるデータセットのライセンス継承（ShareAlike）に注意が必要です。

| データ名 | 出典元 | ライセンス | 商用利用 | 表記義務 | 備考 |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **市区町村境界** | 国土交通省 (国土数値情報) | [政府標準利用規約 (第2.0版)](https://www.mlit.go.jp/ksj/other/agreement.html) | **可** | **必須** | CC BY 4.0 互換。加工時はその旨を記載する必要あり。 |
| **夜間光データ** | NASA/NOAA (VIIRS) | [U.S. Government Work](https://earthdata.nasa.gov/earth-observation-data/data-use-policy) / CC BY 4.0 | **可** | **必須** (推奨) | 公有財産(Public Domain)に近いが、引用が強く推奨される。 |
| **人口メッシュ** | e-Stat (総務省統計局) | [政府標準利用規約 (第2.0版)](https://www.e-stat.go.jp/terms-of-use) | **可** | **必須** | CC BY 4.0 互換。 |
| **POIデータ** | OpenStreetMap (Geofabrik) | [ODbL (Open Database License)](https://www.openstreetmap.org/copyright) | **可** | **必須** | **【要注意】** 継承条項あり。 |

### ⚠️ OpenStreetMap (ODbL) に関する重要事項

本プロジェクトでは、OSMデータ（POI）を集計して「都会度スコア」の算出に使用しています。
ODbLライセンスの規定により、OSMデータを使用して作成された**「派生データベース (Derived Database)」**（この場合、POIスコアを含む `urbanity-score-v2.json` や `japan-with-scores-v2.geojson` が該当する可能性があります）を公開・配布する場合、そのデータベース全体を **ODbL (または互換ライセンス)** で提供する必要があります。

*   **影響**: 生成されたJSON/GeoJSONデータを配布する場合、それらもODbLの下で配布し、利用者が生データにアクセスできるようにする必要があります。
*   **対策**: アプリケーション内の「地図画像」や「検索結果」としての表示のみであれば「生成物 (Produced Work)」とみなされ、ODbLの継承は不要な場合が多いですが、今回は**GeoJSONデータそのものをクライアントに配信**しているため、データベースの配布とみなされる可能性が高いです。
*   **推奨**: `frontend/public/data` 内の成果物にも ODbL ライセンスを適用し、その旨を明記することをお勧めします。

---

## 2. ライブラリ

主要なライブラリは全て一般的なオープンソースライセンス（MIT, BSD, Apache）であり、**商用利用は可能**です。
通常、ソフトウェアの「About」画面や法務情報ページ、あるいはソースコード同梱のライセンスファイルにて著作権表示を行う必要があります。

### フロントエンド (JavaScript/TypeScript)

| ライブラリ | ライセンス | 商用利用 | 備考 |
| :--- | :--- | :--- | :--- |
| **React** | MIT | **可** | |
| **MapLibre GL JS** | BSD 3-Clause | **可** | マップ表示枠内右下の著作権表示（Attribution Control）は削除せず維持することが推奨されます。 |

### バックエンド/スクリプト (Python)

| ライブラリ | ライセンス | 商用利用 | 備考 |
| :--- | :--- | :--- | :--- |
| **GeoPandas** | BSD 3-Clause | **可** | |
| **pandas** | BSD 3-Clause | **可** | |
| **NumPy** | BSD 3-Clause | **可** | |
| **scikit-learn** | BSD 3-Clause | **可** | |
| **Rasterio** | BSD 3-Clause | **可** | |
| **PyOsmium** | BSD 2-Clause | **可** | |

---

## 3. 具体的な表記例

アプリケーションの「About」ページや、マップの隅（Attribution Control）に以下の表記を含めることを推奨します。

### マップ上の表記（MapLibre GLのAttributionに追加）

```text
© OpenStreetMap contributors, 出典: 国土交通省国土数値情報, e-Stat, NASA/NOAA VIIRS
```

### アプリケーション内/ドキュメントでの詳細表記

```markdown
### データ出典
本アプリケーションでは以下のデータを使用・加工して表示しています。

1.  **市区町村境界データ**: 国土交通省 国土数値情報（行政区域データ）を加工して作成
2.  **人口データ**: 総務省統計局 平成27年国勢調査（500mメッシュ）
3.  **夜間光データ**: NASA/NOAA VIIRS Nighttime Lights
4.  **施設データ**: © OpenStreetMap contributors (ODbL)

### ライセンスについて
本機能で使用しているデータの一部（都会度スコア等）は、OpenStreetMapデータを含むため、Open Database License (ODbL) の下で提供されています。
```
