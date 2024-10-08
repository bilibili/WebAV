import { resolve } from 'path';
import { defineConfig } from 'vitest/config';
export default defineConfig({
  test: {
    silent: false,
    browser: {
      enabled: true,
      name: 'chrome', // browser name is required
      headless: true,
    },
  },
  publicDir: resolve(__dirname, '../../doc-site/public'),
});
