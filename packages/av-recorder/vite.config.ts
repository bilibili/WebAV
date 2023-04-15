import { resolve } from 'path'
import { defineConfig } from 'vitest/config'
export default defineConfig({
  test: {
    environment: 'jsdom',
    coverage: {
      provider: 'istanbul' // or 'c8'
    },
  },
  build: {
    lib: {
      entry: resolve(__dirname, 'src/av-recorder.ts'),
      name: 'av-recorder',
    }
  }
})
