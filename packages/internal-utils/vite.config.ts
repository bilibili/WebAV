import { resolve } from 'path';
import { defineConfig } from 'vite';
import dts from 'vite-plugin-dts';
import { externalizeDeps } from 'vite-plugin-externalize-deps';
import pkgJson from './package.json';

export default defineConfig({
  plugins: [dts({ rollupTypes: true }), externalizeDeps()],
  define: {
    PKG_VERSION: JSON.stringify(pkgJson.version),
  },
  build: {
    sourcemap: true,
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'av-internal-utils',
    },
  },
  test: {
    browser: {
      enabled: true,
      name: 'chrome', // browser name is required
      headless: true,
    },
  },
});
