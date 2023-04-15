import { resolve } from 'path'
import { defineConfig } from 'vitest/config'
export default defineConfig({
  build: {
    lib: {
      entry: resolve(__dirname, 'src/av-recorder.ts'),
      name: 'av-recorder',
    },
  }
})
