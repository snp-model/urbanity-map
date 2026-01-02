# Urbanity Map フロントエンド

React + TypeScript + Vite で構築されたフロントエンドアプリケーション。

## 概要

日本全国の市区町村の都会度と光害度を可視化するインタラクティブマップアプリケーションです。

## 機能

- **2つの表示モード**
  - 🏙️ **都会度モード**: 夜間光・人口・POI・地価の4層統合スコアを表示
  - ⭐ **光害度モード**: 夜間光データによる光害レベルを表示
- **統計データ表示**: 人口増加率・高齢者割合・課税所得など
- **インタラクティブマップ**: MapLibre GL JS + 国土地理院タイル
- **市区町村選択**: クリックでスコア詳細を表示
- **動的カラーリング**: モードに応じた色分け表示

## セットアップ

```bash
npm install
npm run dev
```

ブラウザで http://localhost:5173 を開いてください。

## 開発コマンド

| コマンド | 説明 |
|---------|------|
| `npm run dev` | 開発サーバー起動（http://localhost:5173） |
| `npm run build` | プロダクションビルド |
| `npm run preview` | ビルド後のプレビュー |
| `npm run lint` | ESLintによるコードチェック |

## ディレクトリ構成

```
frontend/
├── public/
│   └── data/                          # データファイル（Gitに含まれる）
│       ├── japan-with-scores-v2.geojson  # スコア付き市区町村境界
│       ├── urbanity-score-v2.json        # 統合スコアJSON
│       ├── demographics.json             # 人口統計（人口増加率・高齢者割合）
│       ├── land_price.json               # 地価データ
│       └── tax_income.json               # 課税所得データ
├── src/
│   ├── App.tsx                        # メインコンポーネント
│   ├── App.css                        # スタイル
│   ├── index.css                      # グローバルスタイル
│   └── main.tsx                       # エントリーポイント
└── index.html
```

## データについて

フロントエンドで使用するデータは `public/data/` に配置されています。

- データの準備方法については [データ準備ガイド](../docs/DATA_PREPARATION.md) を参照してください
- 処理済みデータ（約13MB）はGitリポジトリに含まれています

## 技術スタック

- **React 18**: UIライブラリ
- **TypeScript**: 型安全性
- **Vite**: 高速ビルドツール
- **MapLibre GL JS**: オープンソース地図ライブラリ
- **Vanilla CSS**: スタイリング

## 注意事項

- React StrictMode は無効化しています（MapLibre との互換性のため）
- 地図データは国土地理院の淡色地図タイルを使用しています
