---
nav: DEMO
group:
  title: 视频录制
  order: 4

order: 2
---

# 录制 AVCanvas

`AVCanvas` 基于 Canvas 封装，可以添加各种素材，支持用户与之交互，或通过程序添加素材、控制素材位置来制作动画；  
素材包括：摄像头、麦克风、屏幕、文字、图片、音视频文件。

使用 `AVRecorder` 可以录制 `AVCanvas`，输出 MP4 文件。

<code src="./recorder-avcanvas.tsx"></code>

:::info
暂未实现右键菜单，用户无法使用鼠标点击删除素材，可通过程序接口删除素材。
:::

:::info
添加本地音视频文件素材（Video、Audio）时，声音会录制到流中，但不会通过扬声器播放出来
:::
