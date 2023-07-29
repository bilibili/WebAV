# WebAV

Audio and video tools built using pure web technology, which is planned to include creation, editing, and export features, which can be applied to live streaming, record tutorials, video clips, etc.  
使用纯Web技术构建的音视频工具，计划包含创建、编辑、导出功能，可应用于直播、教程录制、视频剪辑等产品中。  

## Motivation
Chrome version 94 supports the WebCodecs API, meaning that JS can also have the ability to process audio and video. Before this, the front-end development in a limited number of scenarios will use ffmpeg.js, a simple test of decoding and re-encoding video shows that WebCodecs performance 20x better than ffmpeg.js.  
Chrome 94 开放了 WebCodecs API，意味着 JS 也能处理音视频了。在此之前，前端开发在会在有限的场景使用 ffmpeg.js，经过简单地测试解码和重编码视频发现，WebCodecs 性能是 ffmpeg.js 的 20 倍。  

This is an experimental project that tries to provide an easy-to-use API for processing audio and video data in the browser. The project in development, so you can submit issues for bugs and new feature suggestions.  
这是一个实验性项目，尝试提供简单易用的 API 在浏览器中处理音视频数据。项目正在积极迭代，可提交 issue 来反馈 Bug 和新功能建议。  


## Packages
- [AVCliper](packages/av-cliper/README.md)  
  Audio and video editing tool library.  
  音视频剪辑工具库。 
- [AVCanvas](packages/av-canvas/README.md)  
  Combine Text, Image, Video, Audio, UserMedia, DisplayMedia to generate MediaStream.  
  使用文字、图片、音视频文件、摄像头&麦克风、分享屏幕来生成 MediaStream。  
- [AVRecorder](packages/av-recorder/README.md)  
  Record MediaStream, export MP4 stream.  
  录制 MediaStream，导出 MP4 流。  

## Features
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
- [画布添加各种素材，可录制导出 MP4](https://hughfenghen.github.io/WebAV/demo/record-avcanvas.html)
- [SDK 合并 MP4 与各种素材](https://hughfenghen.github.io/WebAV/demo/concat-media.html)
- [录制摄像头麦克风，导出 MP4](https://hughfenghen.github.io/WebAV/demo/record-usermedia.html)
- [解码音视频、动图等](https://hughfenghen.github.io/WebAV/demo/decode-media.html)

---

加入[Discord](https://discord.gg/ZD9KF6TV)实时交流  

[Web 音视频系列文章](https://hughfenghen.github.io/tag/WebAV/)，更新中...  

[Plan](./plan.md)