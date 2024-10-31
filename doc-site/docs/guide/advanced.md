---
nav:
  title: 指南
  order: 2
group:
  title: 开始
order: 4
---

# 进阶

WebAV 提供了两个途径来扩展能力，以支持多元的业务场景。

## 拦截器（逐帧处理）

如果你需要对视频进行逐帧处理，比如给视频添加滤镜、美颜或移除数字人绿幕背景，可以使用 `MP4Clip` 提供的 [tickInterceptor](https://bilibili.github.io/WebAV/_api/av-cliper/classes/MP4Clip.html#tickInterceptor) 方法。

参考移除绿幕背景的 [DEMO](https://bilibili.github.io/WebAV/demo/3_2-chromakey-video)，可了解 API 的具体使用方法。

`tickInterceptor` 同样也能处理音频数据，比如实现音频的实时变声、变速、美声等等。

## 自定义素材

如果你想把第三方来源（canvas、pixi.js）或是通过程序生成的**图像、音频数据**合成为视频文件，或是对已有素材施加复杂控制逻辑，则可使用自定义素材实现。

官方提供了一个将**程序通过 canvas 生成的倒计时图像合成为视频**的 [DEMO](https://bilibili.github.io/WebAV/demo/2_6-custom-clip)，介绍如何使用该功能。
