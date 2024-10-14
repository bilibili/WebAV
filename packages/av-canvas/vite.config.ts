import { resolve } from 'path';
import { defineConfig } from 'vite';
import fixReactVirtualized from 'esbuild-plugin-react-virtualized';

export default defineConfig({
  build: {
    sourcemap: true,
    lib: {
      entry: resolve(__dirname, 'src/index.ts'),
      name: 'av-canvas',
    },
    rollupOptions: {
      external: ['@webav/av-cliper'],
    },
  },
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
        optimizeDeps: {
          esbuildOptions: {
            plugins: [fixReactVirtualized],
          },
        },
      }
    : {}),
});
