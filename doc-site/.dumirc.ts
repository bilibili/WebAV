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
    '@webav/av-recorder': path.resolve(
      __dirname,
      '../packages/av-recorder/src/av-recorder.ts',
    ),
    '@webav/av-canvas': path.resolve(
      __dirname,
      '../packages/av-canvas/src/index.ts',
    ),
  },
  sitemap: {
    hostname: 'https://bilibili.github.io/WebAV/',
  },
  analytics: { ga_v2: 'G-MC335K4KV6' },
  themeConfig: {
    name: 'WebAV',
    logo: false,
    hideHomeNav: true,
    socialLinks: {
      github: 'https://github.com/bilibili/WebAV',
    },
    footer: ' ',
    footerConfig: {
      bottom:
        '<div>碰到问题请去 <a href="https://github.com/bilibili/WebAV/issues" >WebAV Issues</a> 中反馈</div><div class="flex" style="justify-content: center;"><a href="https://github.com/bilibili/WebAV"><img src="https://img.shields.io/github/stars/bilibili/WebAV"></a></div>',
      copyright: ' ',
      columns: [],
    },
    apiHeader: false,
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
  targets: { chrome: 102 },
  mfsu: false,
  legacy: { nodeModulesTransform: false },
  locales: [
    { id: 'zh-CN', name: '简体中文' },
    { id: 'en-US', name: 'English' },
  ],
});
