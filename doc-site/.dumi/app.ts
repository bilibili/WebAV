import { type IPreviewerProps } from 'dumi';
import { type Project } from '@stackblitz/sdk';

export function modifyStackBlitzData(memo: Project, props: IPreviewerProps) {
  // if use default template: 'create-react-app', demo won't install dependencies automatically
  memo.template = 'node';
  Object.entries(memo.files).forEach(([name, content]) => {
    if (name !== 'index.html' && name !== 'package.json') {
      memo.files[`src/${name}`] = content;
    }
    delete memo.files[name];
  });
  Object.entries(template).forEach(([name, content]) => {
    if (name === 'package.json') {
      const packageJson = JSON.parse(content);
      const npmDeps = Object.entries(props.asset.dependencies || {})
        .filter(([key, value]) => value.type === 'NPM')
        .reduce((acc: { [key: string]: any }, [key, value]) => {
          acc[key] = value.value;
          return acc;
        }, {});
      packageJson.dependencies = { ...npmDeps, ...packageJson.dependencies };
      content = JSON.stringify(packageJson, null, 2);
    }
    memo.files[name] = content;
  });

  return memo;
}

const template = {
  'tsconfig.json': `
{
  "compilerOptions": {
    "target": "ES2020",
    "useDefineForClassFields": true,
    "lib": ["ES2020", "DOM", "DOM.Iterable"],
    "module": "ESNext",
    "skipLibCheck": true,

    /* Bundler mode */
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "resolveJsonModule": true,
    "isolatedModules": true,
    "noEmit": true,
    "jsx": "react-jsx",

    /* Linting */
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noFallthroughCasesInSwitch": true
  },
  "include": ["src"],
  "references": [{ "path": "./tsconfig.node.json" }]
}
`,
  'tsconfig.node.json': `
{
  "compilerOptions": {
    "composite": true,
    "skipLibCheck": true,
    "module": "ESNext",
    "moduleResolution": "bundler",
    "allowSyntheticDefaultImports": true,
    "strict": true
  },
  "include": ["vite.config.ts"]
}
`,
  'vite.config.ts': `
import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import fixReactVirtualized from 'esbuild-plugin-react-virtualized';

// https://vitejs.dev/config/
export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    esbuildOptions: {
      // 仅用于修复视频剪辑 demo，时间轴模块的依赖 @xzdarcy/react-timeline-editor 的 导入问题
      plugins: [fixReactVirtualized],
    },
  },
});
`,
  'index.html': `
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <link rel="icon" type="image/svg+xml" href="/vite.svg" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Vite + React + TS</title>
    <link rel="stylesheet" href="./src/index.css">
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/index.tsx"></script>
  </body>
</html>
`,
  'package.json': `
{
  "name": "An auto-generated demo by dumi",
  "private": true,
  "version": "0.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "tsc && vite build",
    "preview": "vite preview"
  },
  "dependencies": {
    "react": "^18.2.0",
    "react-dom": "^18.2.0",
    "antd": "^5.11.5"
  },
  "devDependencies": {
    "@types/react": "^18.2.66",
    "@types/react-dom": "^18.2.22",
    "@vitejs/plugin-react": "^4.2.1",
    "typescript": "^5.2.2",
    "esbuild-plugin-react-virtualized": "^1.0.4",
    "postcss": "^8.4.38",
    "tailwindcss": "^3.4.1",
    "vite": "^5.2.0"
  }
}
`,
  'tailwind.config.js': `
module.exports = {
  theme: {},
  variants: {},
  plugins: [],
  content: [
    './src/**/*.tsx',
  ],
}`,
  'src/index.css': `
  @tailwind components;
  @tailwind utilities;
`,
  'postcss.config.js': `
export default {
  plugins: {
    tailwindcss: {},
  },
};`
}
