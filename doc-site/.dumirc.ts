import { defineConfig } from 'dumi';
import path from 'path';

export default defineConfig({
  plugins: ['@umijs/plugins/dist/tailwindcss'],
  tailwindcss: {}, //在umi中，表示启用该插件
  alias: {
    '@webav/av-cliper': path.resolve(
      __dirname,
      '../packages/av-cliper/src/index.ts',
    ),
    // av-recorder 使用 vite 的 import worker，umi 不兼容
    // '@webav/av-recorder': path.resolve(
    //   __dirname,
    //   '../packages/av-recorder/src/av-recorder.ts',
    // ),
    '@webav/av-canvas': path.resolve(
      __dirname,
      '../packages/av-canvas/src/index.ts',
    ),
  },

  analytics: { ga_v2: 'G-MC335K4KV6' },
  themeConfig: {
    name: 'WebAV',
    logo: false,
    socialLinks: {
      github: 'https://github.com/bilibili/WebAV',
    },
    footer:
      '<div>碰到问题请去 <a href="https://github.com/bilibili/WebAV/issues/">WebAV Issues</a> 中反馈</div><div class="flex" style="justify-content: center;"><a class="github-button" href="https://github.com/bilibili/WebAV" data-color-scheme="no-preference: light; light: light; dark: dark;" data-icon="octicon-star" data-size="large" data-show-count="true" aria-label="Star hughfenghen/WebAV on GitHub">Star</a></div>',
  },
  ...(process.env.NODE_ENV === 'development'
    ? {
        base: '/',
        publicPath: '/',
      }
    : {
        base: '/WebAV/',
        publicPath: '/WebAV/',
      }),
  targets: { chrome: 94 },
  legacy: { nodeModulesTransform: false },
});
