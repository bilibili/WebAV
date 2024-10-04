---
nav:
  title: 指南
  order: 2
group:
  title: 其他
  order: 4
order: 1
---

# 贡献指南

如果你愿意帮助改进 WebAV 项目，在此先向勇士致以崇高的敬意🫡。

欢迎任何有助项目发展的贡献，包括但不限于

- 社区互助解答 Issues
- 文档：优化项目站点、API 文档、翻译
- 代码：Bugfix、新功能、单元测试
- 资金赞助

新增 API、改动 API 或有大量代码改动的 bugfix，开始前务必先与项目维护者在 issue 中讨论，浪费勇士们的时间是莫大的罪过。

---

**文档、代码**贡献请阅读下文内容

## 运行项目

1. clone 当前项目到本地
2. 在根目录下执行 `pnpm install && pnpm build`
3. cd 跳转到特定 package (假设为 av-cliper)，运行 `pnpm dev`
4. path 为 DEMO 目录下的文件名，如 `concat-media.html`
5. 在浏览器中打开 DEMO URL，如 `http://localhost:6066/concat-media.html`
6. `pnpm test` 运行该 package 的单元测试

## 运行 WebAV 站点

1. clone 当前项目到本地
2. 在根目录下执行 `pnpm install && pnpm build`
3. cd 跳转到 `doc-site` 目录，执行 `pnpm dev`
4. 根据终端提示，访问指定 URL

启动本地站点能更流畅地体验 DEMO，站点还包含更多的示例可用于测试功能是否正常。

## Commit 规范

Commit message 格式规范请了解 [Angular's commit convention](https://github.com/conventional-changelog/conventional-changelog/tree/master/packages/conventional-changelog-angular)。

## 代码规范

1. 本项目使用 prettier 格式化代码，请安装 prettier 插件，避免代码样式冲突，或格式化对 PR 代码产生干扰。
2. 提交 PR 前务必运行单元测试（后续会在工作流中加入自动校验）

## 项目工作流

本项目使用 [changesets](https://github.com/changesets/changesets) 管理并自动发布版本；

创建 PR 后需使用 `pnpm changeset add` 命令添加该 PR 的描述，以便自动生成 changelog、更新 package 的版本号；

否则 PR 下会有机器人提醒，详情请阅读 changesets 文档。
