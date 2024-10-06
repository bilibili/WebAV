---
nav:
  title: 指南
  order: 2
group:
  title: 开始
  order: 1
order: 1
---

# 快速上手

## 安装依赖

:::code-group

```bash [npm]
npm install @webav/av-cliper

npm install @webav/av-canvas
```

```bash [pnpm]
pnpm add @webav/av-cliper

pnpm add @webav/av-canvas
```

:::

如果你先项目依赖多个 `@webav/*` 下的包，务必让它们的版本号保持一致。

## 项目目录

```
- doc-site              // 文档站点
- packages              // pnpm 管理的 monorepo，阅读模块介绍章节了解更多
  - av-cliper
  - av-canvas
  - av-recorder
package.json
```

启动项目或站点，请阅读[贡献指南](./contribution)章节。

## 更进一步

- 体验 [DEMO](../demo) 了解项目的能力
- 每个 DEMO 都可以展开查看代码，通过示例代码了解如何集成到你的项目
- 通过 API 或源码了解更多细节
- 如果你是该领域的新手，建议先阅读[相关文章](../article)
