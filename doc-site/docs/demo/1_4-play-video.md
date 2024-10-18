---
nav: DEMO
group:
  title: 解码
  order: 2

order: 4
---

# 解码播放

使用 `WebCodecs + canvas + Web Audio` 来解码播放视频，能获取到视频原始图像、音频数据。

该方案拥有最完整的播放控制能力，是原生 `video` 标签无法实现的，比如：

- 低延迟场景的 buffer 控制
- 根据设备压力状况丢帧
- 解码异常时自动恢复
- 逐帧播放、超快倍速播放
- 倍速播放音频不变调
- 自定义播放 FPS

该方案的**代价**是增加了复杂度，应优先考虑使用 `video` 播放，除非无法满足诉求。

### 播放 MP4

<code src="./1_4_1-play-video.tsx"></code>
