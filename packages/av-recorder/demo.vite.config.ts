import { resolve } from 'path'
import { defineConfig } from 'vitest/config'
export default defineConfig({
  base: './',
  build: {
    rollupOptions: {
      input: {
        main: resolve(__dirname, 'demo/record-usermedia.html'),
      },
    },
    outDir: 'demo-dist'
  },
})
