---
nav: DEMO
group:
  title: 视频录制
  order: 4

order: 1
---

# 直播录制

`AVCanvas` 支持用户添加各种素材，并拖动改变它们的位置，非常容易集成的**直播推流**工作台中。

v0.10 新增支持 `MediaStreamClip`，用于增强直播推流场景，如分享桌面、播放音视频资源、摄像头/麦克风、与其他主播连线（连麦）等实时音视频流；

`AVCanvas.captureStream()` 能合成所有素材的图像与音频，返回 `MediaStream` 可用于 WebRTC 推流。

可使用 `AVRecorder` 录制 `MediaStream`，将生成的 MP4 文件流（`ReadableStream`）保存到本地、或上传到服务器、或用于 WebSocket 推流。

<code src="./recorder-avcanvas.tsx"></code>

:::info
DEMO 未实现删除素材、修改素材层级等 UI，API 已提供此类基础能力。
:::

:::info
`MediaStreamClip` 是**实时流**，所以无法应用于 Combinator 中**加速**合成视频。
:::
