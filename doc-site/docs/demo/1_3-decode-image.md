---
nav: DEMO
group: 解码
order: 3
---

# 解码动图

动图有多种格式，最古老常见的是 `gif`；  
动图是由多个静态图片帧组成的，可使用浏览器 API `ImageDecoder` 解码；  
或使用 `ImgClip.tick(time)` 获取指定时间的图像帧；

<code src="./decode-image.tsx"></code>

:::info
注意：`ImgClip.meta.duration = Infinity`，动图默认会根据时间参数循环取帧。
:::
