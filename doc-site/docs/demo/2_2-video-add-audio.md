---
nav: DEMO
group:
  title: 合成

order: 2
---

# 视频配音

<code src="./2_2_1-video-add-audio.tsx"></code>

:::warning
`AudioClip` 内部使用了 `AudioContext` 解码音频文件，所以无法在 WebWorker 中工作。
:::

**动图配音生成视频**

<code src="./2_2_2-video-add-audio.tsx"></code>
