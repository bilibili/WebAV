import { defineConfig } from 'dumi';

export default defineConfig({
  themeConfig: {
    name: 'WebAV',
    logo: false,
  },
  ...(process.env.NODE_ENV === 'development' ? {
    base: '/',
    publicPath: '/',
  } : {
    base: '/WebAV/',
    publicPath: '/WebAV/',
  }),
});
