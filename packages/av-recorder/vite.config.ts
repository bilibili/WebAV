import { defineConfig } from 'vitest/config'
export default defineConfig({
  test: {
    environment: 'jsdom',
    coverage: {
      provider: 'istanbul' // or 'c8'
    }
  }
})
