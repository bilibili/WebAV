---
nav:
  title: API
  order: 3
sidebar: false
---

WebAV 项目包含三个模块，使用 TypeDoc 生成 API 文档

- [@webav/av-cliper](//bilibili.github.io/WebAV/_api/av-cliper/)
  - 提供音视频数据处理的基础 API
  - 包括：音视频解码、合成、拼接、裁剪等功能等等
- [@webav/av-recorder](//bilibili.github.io/WebAV/_api/av-recorder/)
  - 录制 `MediaStream`，输出 MP4 视频
  - 在浏览器中，可以中 canvas、video、摄像头、麦克风、分享屏幕等 API 获取 `MediaStream` 对象
- [@webav/av-canvas](//bilibili.github.io/WebAV/_api/av-canvas/)
  - 用户或代码可操作的“画布”，能添加、控制各种素材，支持输出 `MediaStream`
  - 素材包括：摄像头、麦克风、屏幕、音视频文件、图片、文字
  - 输出 `MediaStream` 意味着能将“画布”内容推流至服务器或录制为本地视频

`@webav/av-cliper` 的 API 相对多一些，建议先阅读[基础概念](https://bilibili.github.io/WebAV/_api/av-cliper/#md:basic-concepts-%E5%9F%BA%E7%A1%80%E6%A6%82%E5%BF%B5)，有助于快速理解 DEMO 源码与其他 API
