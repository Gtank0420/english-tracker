/// <reference types="vitest/config" />
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { VitePWA } from 'vite-plugin-pwa'

// GitHub Pages ではリポジトリ名がパスになる (https://gtank0420.github.io/english-tracker/)
const base = '/english-tracker/'

export default defineConfig({
  base,
  plugins: [
    react(),
    VitePWA({
      // 新しい版は「更新」を押したときに切り替える (入力中に再読み込みしないため)
      registerType: 'prompt',
      includeAssets: ['icon.svg', 'apple-touch-icon.png', 'favicon-48x48.png'],
      manifest: {
        name: '英語学習ノート',
        short_name: '英語学習ノート',
        description: '入省までの英語学習の記録',
        lang: 'ja',
        start_url: base,
        scope: base,
        display: 'standalone',
        background_color: '#f5f0e4',
        theme_color: '#f5f0e4',
        icons: [
          { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
          { src: 'maskable-512x512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        // アプリ本体 (Firebase の部分も含む) をすべて端末に持ち、オフラインで起動できるようにする
        globPatterns: ['**/*.{js,css,html,svg,png,woff2}'],
        maximumFileSizeToCacheInBytes: 4 * 1024 * 1024,
        navigateFallback: 'index.html',
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.origin === 'https://fonts.googleapis.com',
            handler: 'StaleWhileRevalidate',
            options: { cacheName: 'google-fonts-css' },
          },
          {
            // 日本語フォントは文字の範囲ごとに分かれているので、使った分だけ保存する
            urlPattern: ({ url }) => url.origin === 'https://fonts.gstatic.com',
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts-files',
              expiration: { maxEntries: 400, maxAgeSeconds: 60 * 60 * 24 * 365 },
              cacheableResponse: { statuses: [0, 200] },
            },
          },
        ],
      },
    }),
  ],
  // 大きいのは必要になってから読む Firebase の部分だけ
  build: { chunkSizeWarningLimit: 700 },
  test: {
    environment: 'node',
    include: ['src/**/*.test.ts'],
  },
})
