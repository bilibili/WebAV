import { resolve } from 'path'
import { defineConfig } from 'vitest/config'
export default defineConfig({
  test: {
    environment: 'jsdom',
    coverage: {
      provider: 'istanbul' // or 'c8'
    }
  },
  build: {
    target: 'esnext',
    minify: false,
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      formats: ['es'],
      fileName: 'idnex'
    }
  }
})
