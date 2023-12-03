import { defineConfig } from 'dumi';

export default defineConfig({
  themeConfig: {
    name: 'WebAV',
    logo: false,
    footer: 'Powered by <a href="https://github.com/hughfenghen/WebAV">WebAV</a>'
  },
  ...(process.env.NODE_ENV === 'development' ? {
    base: '/',
    publicPath: '/',
  } : {
    base: '/WebAV/',
    publicPath: '/WebAV/',
  }),
});
