/**
 * @fileoverview Reactアプリケーションのエントリーポイント
 *
 * このファイルはReactアプリケーションのルートコンポーネントをDOMにマウントします。
 * Strict Modeは開発時のパフォーマンスを考慮して無効化しています。
 */

import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

/**
 * Reactアプリケーションのルートをレンダリング
 *
 * @description
 * 'root' IDを持つDOM要素にAppコンポーネントをマウントします。
 * createRootを使用してReact 18の並行レンダリング機能を有効化しています。
 */
createRoot(document.getElementById('root')!).render(
  <App />
)
