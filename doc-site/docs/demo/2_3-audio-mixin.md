---
nav: DEMO
group:
  title: 合成

order: 3
---

# 音频合成

## 混音

混合两个音频文件，输出 m4a 音频文件。

`new Combiator` 不提供 `width, height` 或任意一个值为 0，则不会创建视频轨道，生成的是 m4a 音频文件。

<code src="./2_3_1-audio-mixin.tsx"></code>

:::warning
`AudioClip` 内部使用了 `AudioContext` 解码音频文件，所以无法在 WebWorker 中工作。
:::

## 拼接音频

将两个音频文件首尾相连，输出 m4a 音频文件。

<code src="./2_3_2-audio-mixin.tsx"></code>
