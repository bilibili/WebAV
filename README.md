# WebAV

An audio/video toolkit built with pure web technologies, planned to include creation, editing, and exporting capabilities, applicable to products like live streaming, tutorial recording, video clipping, etc.

使用纯 Web 技术构建的音视频工具，计划包含创建、编辑、导出功能，可应用于直播、教程录制、视频剪辑等产品中。

## Motivation

Chrome 94 released the WebCodecs API, meaning JS can now handle audio/video as well. Before this, frontend developers could only use ffmpeg.wasm in limited scenarios. Through simple tests of decoding and re-encoding videos, it was found WebCodecs has 20x the performance of ffmpeg.wasm.

Chrome 94 开放了 WebCodecs API，意味着 JS 也能处理音视频了。在此之前，前端开发在会在有限的场景使用 ffmpeg.wasm，经过简单地测试解码和重编码视频发现，WebCodecs 性能是 ffmpeg.wasm 的 20 倍。

This is an experimental project attempting to provide easy-to-use APIs for handling audio/video data in the browser. The project is under active development, feel free to open issues to report bugs or suggest new features.

这是一个实验性项目，尝试提供简单易用的 API 在浏览器中处理音视频数据。项目正在积极迭代，可提交 issue 来反馈 Bug 和新功能建议。

## Packages

- [AVCliper](packages/av-cliper/README.md)  
  Audio/Video Clipping Toolkit.  
  音视频剪辑工具库。
- [AVCanvas](packages/av-canvas/README.md)  
  Combine Text, Image, Video, Audio, UserMedia, DisplayMedia to generate MediaStream.  
  使用文字、图片、音视频文件、摄像头&麦克风、分享屏幕来生成 MediaStream。
- [AVRecorder](packages/av-recorder/README.md)  
  Record MediaStream, export MP4 stream.  
  录制 MediaStream，导出 MP4 流。

## Features

- Audio/Video Clipper [AVCliper](packages/av-cliper/README.md)
  - Combine mp4, mp3, images, text by timeline
  - Embed SRT subtitles
  - Video muting, audio mixing, volume control, audio looping, audio resampling
  - Video frame by frame processing, built-in chroma key
  - Animation properties: x, y, w, h, opacity, angle
- Canvas [AVCanvas](packages/av-canvas/README.md)
  - Move, rotate, flip, scale to fit, warp
  - Media sources: camera, microphone, screen sharing
  - Resource types: video, audio, image, text
- Recorder [AVRecorder](packages/av-recorder/README.md)

  - Record video from MediaStream, AVCanvas, export to MP4

- 音视频剪辑 [AVCliper](packages/av-cliper/README.md)
  - mp4、mp3、图片、文字 按时间线合成
  - 嵌入 SRT 字幕
  - 视频消音、音频混流、音量控制、音频循环、音频重采样
  - 视频逐帧处理，内置 绿幕抠图
  - 动画属性：x, y, w, h, opacity, angle
- 画布 [AVCanvas](packages/av-canvas/README.md)
  - 移动、旋转、翻转、等比缩放、变形
  - 媒体来源：摄像头、麦克风、分享屏幕
  - 资源类型：视频、音频、图片、文字
- 录制 [AVRecorder](packages/av-recorder/README.md)
  - 从 MediaStream、AVCanvas 中录制视频，导出 MP4

## DEMO

<https://hughfenghen.github.io/WebAV/demo/>

## Development

This repo uses lerna + yarn to manage packages.

1. Install dependencies: Run `yarn install` in root directory
2. Build all packages: Run `yarn build` in root directory
3. Run DEMO
   1. cd into specific package, e.g. `cd packages/av-cliper`
   2. Run `yarn dev`
4. Access DEMO in browser
   1. Copy baseUrl printed in console, e.g. `http://localhost:6066/`
   2. Locate DEMO path, it's filename in `packages/av-cliper/demo` dir, like `concat-media.html`
   3. Open final URL in browser: `http://localhost:6066/concat-media.html`

当前仓库是使用 lerna + yarn 管理 packages。

1. 安装依赖：在根目录执行 `yarn install`
2. 构建所有 packages：在根目录执行 `yarn build`
3. 运行 DEMO
   1. cd 到特定的 package 目录，比如 `cd packages/av-cliper`
   2. 执行 `yarn dev`
4. 访问 DEMO
   1. 复制控制台中打印的 baseUrl，类似 `http://localhost:6066/`
   2. 确定对应 DEMO 的 path，是 `packages/av-cliper/demo` 目录下的文件名，如 `concat-media.html`
   3. 在浏览器打开最终 URL：`http://localhost:6066/concat-media.html`

若你有意贡献代码，建议先跟通过 Github Issue、Discussions、微信（`liujun_fenghen`）与作者讨论

---

加微信 `liujun_fenghen` 备注 WebAV 邀请进入微信群

[Web 音视频系列文章](https://hughfenghen.github.io/tag/WebAV/)

[Plan](./plan.md)
