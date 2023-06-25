import { resolve } from 'path'
import { defineConfig } from 'vitest/config'
export default defineConfig({
  test: {
    environment: 'jsdom',
    coverage: {
      provider: 'istanbul' // or 'c8'
    },
    onConsoleLog (msg) {
      if (msg.includes('log test')) return false
    }
  },
  build: {
    target: 'esnext',
    minify: false,
    emptyOutDir: false,
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es'],
      fileName: 'index'
    }
  }
})
