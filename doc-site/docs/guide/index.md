---
nav: Guide
order: 1

sidebar: false
---

<div style="background: #fff; padding: 16px; border-radius: 10px;">

# 指南

开始前，建议先快速过一遍 [DEMO](../demo/1_1-decode-video.md)，了解 WebAV 能实现哪些能力；

## 接入

在 DEMO 下方有对应源码，添加依赖后复制 DEMO 源码，就能在项目中运行。

```shell
npm install @webav-cliper

yarn add @webav-cliper
```

## API

WebAV 项目包含三个模块，使用 TypeDoc 生成 API 文档

- [@webav/av-cliper](//hughfenghen.github.io/WebAV/_api/av-cliper/)
  - 提供音视频数据处理的基础 API
  - 包括：音视频解码、合成、拼接、裁剪等功能等等
- [@webav/av-recorder](//hughfenghen.github.io/WebAV/_api/av-recorder/)
  - 录制 `MediaStream`，输出 MP4 视频
  - 在浏览器中，可以中 canvas、video、摄像头、麦克风、分享屏幕等 API 获取 `MediaStream` 对象
- [@webav/av-canvas](//hughfenghen.github.io/WebAV/_api/av-canvas/)
  - 用户或代码可操作的“画布”，能添加、控制各种素材，支持输出 `MediaStream`
  - 素材包括：摄像头、麦克风、屏幕、音视频文件、图片、文字
  - 输出 `MediaStream` 意味着能将“画布”内容推流至服务器或录制为本地视频

`@webav/av-cliper` 的 API 相对多一些，建议先阅读[基础概念](https://hughfenghen.github.io/WebAV/_api/av-cliper/#md:basic-concepts-%E5%9F%BA%E7%A1%80%E6%A6%82%E5%BF%B5)，有助于快速理解 DEMO 源码与其他 API

## 贡献

若你对 WebAV 感兴趣，可以尝试在本地启动项目

1. 安装依赖：在根目录执行 `yarn install`
2. 构建所有 packages：在根目录执行 `yarn build`
3. 运行 DEMO
   1. cd 到特定的 package 目录，比如 `cd packages/av-cliper`
   2. 执行 `yarn dev`
4. 访问 DEMO
   1. 复制控制台中打印的 baseUrl，类似 `http://localhost:6066/`
   2. 确定对应 DEMO 的 path，是 `packages/av-cliper/demo` 目录下的文件名，如 `concat-media.html`
   3. 在浏览器打开最终 URL：`http://localhost:6066/concat-media.html`

若你有意贡献代码，建议先通过 Github Issue、Discussions、微信（`liujun_fenghen`）与作者讨论

</div>
