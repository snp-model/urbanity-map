# GitHub Pages 公開手順とドメイン取得ガイド

このドキュメントでは、開発した `urbanity-map` (React + Vite) を GitHub Pages で公開する手順と、独自ドメインの取得・設定方法についてまとめます。

## 1. GitHub Pages 公開手順

Vite 製のアプリケーションを GitHub Pages にデプロイするには、GitHub Actions を使用するのが最もスムーズです。

### 手順 1: `package.json` の設定

`package.json` に `homepage` フィールドは**不要**です（Vite の設定で制御します）。

### 手順 2: `vite.config.ts` の設定

`base` オプションを設定します。
独自ドメインを使用する場合は `/` （デフォルト）で問題ありませんが、GitHub Pages の初期 URL (`https://<username>.github.io/<repo-name>/`) で確認する場合は、リポジトリ名を設定する必要があります。

**独自ドメインを使用する予定がある場合:**
設定変更は不要です（デフォルトのままでOK）。

**サブディレクトリ (`/<repo-name>/`) で公開する場合:**
`vite.config.ts` に以下を追加します。

```typescript
export default defineConfig({
  // ...他設定
  base: process.env.GITHUB_PAGES ? '/urbanity-map/' : '/', 
})
```

### 手順 3: GitHub Actions ワークフローの作成

プロジェクトのルートに `.github/workflows/deploy.yml` を作成し、以下の内容を保存します。これにより、`main` ブランチにプッシュするたびに自動的にビルドとデプロイが行われます。

```yaml
name: Deploy to GitHub Pages

on:
  push:
    branches: ["main"]
  workflow_dispatch:

permissions:
  contents: read
  pages: write
  id-token: write

concurrency:
  group: "pages"
  cancel-in-progress: true

jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - name: Checkout
        uses: actions/checkout@v4

      - name: Setup Node
        uses: actions/setup-node@v4
        with:
          node-version: "20"
          cache: 'npm'
          cache-dependency-path: './frontend/package-lock.json'

      - name: Install dependencies
        run: npm ci
        working-directory: ./frontend

      - name: Build
        run: npm run build
        working-directory: ./frontend

      - name: Upload artifact
        uses: actions/upload-pages-artifact@v3
        with:
          path: ./frontend/dist

  deploy:
    environment:
      name: github-pages
      url: ${{ steps.deployment.outputs.page_url }}
    needs: build
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to GitHub Pages
        id: deployment
        uses: actions/deploy-pages@v4
```

### 手順 4: リポジトリ設定の変更

1.  GitHub リポジトリの **Settings** タブを開きます。
2.  左メニューの **Pages** をクリックします。
3.  **Build and deployment** > **Source** を **GitHub Actions** に変更します。

---

## 2. 固定（独自）ドメインの比較検討

GitHub Pages に独自ドメイン（例: `urbanity-map.jp` や `.com`）を割り当てるためのドメイン取得サービスの比較です。

| サービス名 | 特徴 | 初年度費用(例) | 更新費用(例) | メリット | デメリット |
| :--- | :--- | :--- | :--- | :--- | :--- |
| **Cloudflare** | **推奨**。海外系だがUIは日本語対応。原価提供で最安級。 | 安い (円安影響あり) | **安い** (原価) | 更新費が安い。DNS反映が爆速。GitHub Pagesとの相性が良い。 | 決済がドル建て(クレカ必須)。サポートは英語主体。 |
| **Xserver Domain** | 国内最大手。管理画面が使いやすい。 | 安い (キャンペーン多) | 普通 | 日本語サポートが手厚い。国内サーバー利用者には馴染み深い。 | Cloudflareよりは更新費が少し高い場合がある。 |
| **お名前.com** | ダントツの知名度。 | **最安** (1円〜など) | **高い** | 初年度が極端に安い。 | 画面が広告だらけで分かりにくい。更新費が高い。メール配信が多い。 |
| **Google Domains** | (サービス終了により Squarespace へ移管) | - | - | - | **現在新規取得は非推奨** (Squarespaceへの移管中のため)。 |

### おすすめの選択肢

1.  **技術的な設定に抵抗がない場合 → Cloudflare**
    *   **理由**: 「更新費用が卸値（利益を乗せていない）」であるため、長期的に最も安くなります。また、DNS の性能が非常に高く、世界最速クラスです。GitHub Pages で使う場合、SSL 設定なども Cloudflare 側で柔軟にコントロールできます。
2.  **安心感・日本語サポート重視 → Xserver ドメイン**
    *   **理由**: 管理画面がシンプルで使いやすく、日本の会社なので安心感があります。価格も適正です。

### ドメイン取得後の設定 (GitHub Pages)

1.  ドメイン取得サービス側で **DNS レコード** を設定します。
    *   **CNAME レコード**: ホスト名 `www` (またはサブドメイン) → ターゲット `<username>.github.io`
    *   **A レコード** (ルートドメイン `example.com` を使う場合): GitHub の指定IPアドレス (`185.199.108.153` など4つ) を設定。
2.  GitHub リポジトリの **Settings** > **Pages** > **Custom domain** に取得したドメインを入力し、**Save** を押します。
3.  **Enforce HTTPS** にチェックを入れます。

## 次のアクション

- [ ] ドメイン名を決定し、取得する（Cloudflare または Xserver 推奨）。
- [ ] 上記手順に従い、`.github/workflows/deploy.yml` を作成してデプロイをテストする。
