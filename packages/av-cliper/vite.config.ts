import { resolve } from 'path';
import { defineConfig } from 'vite';

export default defineConfig({
  test: {
    browser: {
      enabled: true,
      name: 'chrome', // browser name is required
      headless: true,
    },
  },
  server: {
    host: '0.0.0.0',
    port: 6066,
  },
  ...(['development', 'test'].includes(process.env.NODE_ENV ?? '')
    ? {
        publicDir: resolve(__dirname, '../../doc-site/public'),
      }
    : {}),
});
