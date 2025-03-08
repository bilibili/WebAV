---
nav:
  title: 指南
  order: 2
group:
  title: 其他
order: 2
---

# FAQ

_有疑问可以先查询 issue、阅读 API 文档。_

### 支持哪些视频格式

- MP4Clip 支持的视频格式有：mp4、mov、m4a
- AudioClip 支持流行音频格式（mp3、wav、m4a...），具体参考 WebAudio API 支持的格式
- 视频编码格式支持：AVC(H264)、HEVC(H265)
  - 暂注意不支持 AV1
  - 是否支持 HEVC(H265) 还取决于你的设备

可阅读文章：[Webcodecs 编解码对视频格式的兼容性（支持性）检测](https://github.com/hughfenghen/hughfenghen.github.io/issues/129)

### WebAV 性能表现怎么样

请阅读 [WebCodecs 性能表现及优化思路](https://hughfenghen.github.io/posts/2024/07/27/webcodecs-performance-benchmark/)

总结：部分设备接近 Native 方案性能，总体上还有一点差距，后续再考虑优化。

### WebAV 兼容性

Chrome/Edge 102+，不支持 Safari，不支持 Firefox。

你可以访问 <https://webav-tech.github.io/WebAV/demo> 检测当前浏览器的兼容性。

移动端以及更详细的兼容信息请查看 [Can i use WebCodecs](https://caniuse.com/?search=WebCodecs)

**且网页必须是 HTTPS 协议或 localhost**，否则

- WebCodecs API 检测将返回不兼容
- 控制台报错 `Cannot read properties of undefined (reading 'getDirectory')`

### 是否支持 Vue 或其他 UI 框架

支持。

WebAV 是一个音视频处理工具库，跟 UI 框架无关。  
DEMO 中的 UI 使用 React 开发，若使用其他 UI 框架重点关注其中 WebAV 的 API 即可。
