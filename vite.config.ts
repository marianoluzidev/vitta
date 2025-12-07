/// <reference types="vitest" />

import legacy from '@vitejs/plugin-legacy'
import vue from '@vitejs/plugin-vue'
import path from 'path'
import { readFileSync } from 'fs'
import { defineConfig } from 'vite'
import { VitePWA } from 'vite-plugin-pwa'

// Read version from package.json
const packageJson = JSON.parse(readFileSync(path.resolve(__dirname, 'package.json'), 'utf-8'))
const appVersion = packageJson.version

// https://vitejs.dev/config/
export default defineConfig({
  define: {
    __APP_VERSION__: JSON.stringify(appVersion),
  },
  plugins: [
    vue(),
    VitePWA({
      registerType: 'autoUpdate',
      manifest: {
        name: 'Vitta',
        short_name: 'Vitta',
        description: 'Vitta, tu tiempo en orden',
        theme_color: '#08b8a4',
        background_color: '#ffffff',
        display: 'standalone',
        start_url: '/agenda',
        icons: [
          {
            src: '/icons/vitta-192.png',
            sizes: '192x192',
            type: 'image/png',
          },
          {
            src: '/icons/vitta-512.png',
            sizes: '512x512',
            type: 'image/png',
          },
        ],
      },
    }),
    legacy(),
  ],
  resolve: {
    alias: {
      '@': path.resolve(__dirname, './src'),
    },
  },
  test: {
    globals: true,
    environment: 'jsdom'
  }
})
