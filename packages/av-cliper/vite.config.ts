import { resolve } from 'path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { externalizeDeps } from 'vite-plugin-externalize-deps';

export default defineConfig({
  plugins: [dts({ rollupTypes: true }), externalizeDeps()],
  build: {
    sourcemap: true,
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'av-cliper',
    },
  },
  test: {
    browser: {
      provider: 'webdriverio',
      enabled: true,
      name: 'chrome', // browser name is required
      headless: true,
      providerOptions: {
        browserVersion: 'stable',
      },
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
