# Urbanity Map フロントエンド

React + TypeScript + Vite で構築されたフロントエンドアプリケーション。

## セットアップ

```bash
npm install
npm run dev
```

## 開発

| コマンド | 説明 |
|---------|------|
| `npm run dev` | 開発サーバー起動（http://localhost:5173） |
| `npm run build` | プロダクションビルド |
| `npm run preview` | ビルド後のプレビュー |

## ディレクトリ構成

```
frontend/
├── public/
│   └── data/
│       └── urbanity_scores.json   # モック都会度データ
├── src/
│   ├── App.tsx                    # メインコンポーネント
│   ├── App.css                    # アニメーション
│   ├── index.css                  # デザインシステム
│   └── main.tsx                   # エントリーポイント
└── index.html
```

## 主要機能

- **地図表示**: MapLibre GL JS + 国土地理院タイル
- **都会度表示**: 市町村ごとのスコア表示・色分け
- **検索**: 市区町村名による検索

## 注意事項

- React StrictMode は無効化しています（MapLibre との互換性のため）
- 現在はモックデータを使用しています
