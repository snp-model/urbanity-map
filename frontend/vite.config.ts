/**
 * @fileoverview Viteビルドツールの設定ファイル
 *
 * このファイルはViteビルドツールの設定を定義します。
 * Reactプラグインを使用してReactアプリケーションのビルドを行います。
 *
 * @see https://vite.dev/config/
 */

import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

/**
 * Viteの設定
 *
 * @description
 * - React プラグインを有効化してJSX変換とFast Refreshを提供
 */
export default defineConfig({
  plugins: [react()],
})
