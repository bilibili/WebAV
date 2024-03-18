import { resolve } from 'path';
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    browser: {
      enabled: true,
      name: 'edge', // browser name is required
      headless: true,
    },
    // coverage: {
    //   provider: 'istanbul', // or 'c8'
    // },
  },
  publicDir: resolve(__dirname, '../../doc-site/public'),
  build: {
    sourcemap: true,
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'av-cliper',
    },
  },
});
