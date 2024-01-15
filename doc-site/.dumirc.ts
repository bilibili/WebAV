import { defineConfig } from 'dumi';

export default defineConfig({
  analytics: { ga_v2: 'G-MC335K4KV6' },
  themeConfig: {
    name: 'WebAV',
    logo: false,
    socialLinks: {
      github: 'https://github.com/hughfenghen/WebAV'
    },
    footer: false
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
