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
