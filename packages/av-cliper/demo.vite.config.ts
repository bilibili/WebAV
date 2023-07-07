import { resolve } from 'path'
import { defineConfig } from 'vitest/config'
export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: {
        'concat-media': resolve(__dirname, 'demo/concat-media.html'),
        'decode-media': resolve(__dirname, 'demo/decode-media.html'),
        chromakey: resolve(__dirname, 'demo/chromakey.html'),
        'fast-concat-mp4': resolve(__dirname, 'demo/fast-concat-mp4.html')
      }
    },
    outDir: 'demo-dist'
  }
})
