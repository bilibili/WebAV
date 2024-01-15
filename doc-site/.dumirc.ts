import { defineConfig } from 'dumi';

export default defineConfig({
  analytics: { ga_v2: 'G-MC335K4KV6' },
  themeConfig: {
    name: 'WebAV',
    logo: false,
    socialLinks: {
      github: 'https://github.com/hughfenghen/WebAV'
    },
    footer: '欢迎 Star <a href="https://github.com/hughfenghen/WebAV">WebAV</a> 项目，碰到问题请去 <a href="https://github.com/hughfenghen/WebAV/issues/">WebAV Issues</a> 中反馈'
  },
  ...(process.env.NODE_ENV === 'development' ? {
    base: '/',
    publicPath: '/',
  } : {
    base: '/WebAV/',
    publicPath: '/WebAV/',
  }),
  targets: { chrome: 94 },
  legacy: { nodeModulesTransform: false }
});
