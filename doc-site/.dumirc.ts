import { defineConfig } from 'dumi';

export default defineConfig({
  analytics: { ga_v2: 'G-MC335K4KV6' },
  themeConfig: {
    name: 'WebAV',
    logo: false,
    socialLinks: {
      github: 'https://github.com/hughfenghen/WebAV'
    },
    footer: '碰到问题请去 <a href="https://github.com/hughfenghen/WebAV/issues/">WebAV Issues</a> 中反馈 <br/> <a class="github-button" href="https://github.com/hughfenghen/WebAV" data-color-scheme="no-preference: light; light: light; dark: dark;" data-icon="octicon-star" data-size="large" data-show-count="true" aria-label="Star hughfenghen/WebAV on GitHub">Star</a>'
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
