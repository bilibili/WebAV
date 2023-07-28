# AVCliper

WebCodecs-based, combine video, audio, images, text, with animation support  
基于 WebCodecs 合成 视频、音频、图片、文字，支持动画  

## Demo
Source code: `./demo/*.ts`  

[concat media](https://hughfenghen.github.io/WebAV/demo/concat-media.html)  
[decode media](https://hughfenghen.github.io/WebAV/demo/decode-media.html)  
[fast concat mp4](https://hughfenghen.github.io/WebAV/demo/fast-concat-mp4.html), without re-encoding video track  

## Basic Concepts 基础概念
- `Combinator`: add `OffscreenSprite`, ouput video stream
  - Currently only supports outputting binary streams for MP4,AAC format  
- `OffscreenSprite`: wraps the resource (Clip), attaching Rect (position, width, height, animation) information to the resource so that it can be drawn to the Canvas
- `IClip`: Abstract encapsulation of resources, reading (`IClip.tick(time)`) raw data of resources by time slice, has been implemented for the `IClip` interface with: 
  - `MP4Clip, AudioClip, ImgClip, EmbedSubtitlesClip` (embedded SRT subtitles), these are the types of resources supported by `Combinator`  

<hr />

- `Combinator`： 视频合成器， add `OffscreenSprite`， ouput 视频流  
  - 目前仅支持输出 MP4,AAC 格式的二进制流
- `OffscreenSprite`： 包装资源（Clip），给资源附加 Rect（位置、宽高、动画）信息，使得资源可被绘制到 Canvas 上  
- `IClip`： 资源的抽象封装，按时间片段读取（`IClip.tick(time)`）资源的原始数据，已实现 `IClip` 接口的有：  
  - `MP4Clip, AudioClip, ImgClip, EmbedSubtitlesClip`（内嵌SRT字幕），这些是合成视频所支持的资源类型  


## Usage
**Two video overlays**  
Re-encoding, output video formats is MP4(H264), AAC

**两个视频叠加**  
重新编码，输出音视频格式为 MP4(H264), AAC  

```ts
import { Combinator, OffscreenSprite, MP4Clip } from '@webav/av-cliper'

const com = new Combinator({
  // 画布大小，视频分辨率
  width: 1280,
  height: 720
})
const spr1 = new OffscreenSprite(
  'spr1',
  new MP4Clip((await fetch('<mp4 url>')).body!)
)
const spr2 = new OffscreenSprite(
  'spr1',
  new MP4Clip((await fetch('<mp4 url>')).body!)
)
// 合并成长度 10s 的视频，丢弃 10s 以后的部分
await com.add(spr1, { duration: 10, main: true })
// 第二个视频从第 3s 开始出现，叠加在第一个视频上方
await com.add(spr2, { offset: 3 })
// com.output() return a ReadableStream, upload or save to disk
```

**Quickly concatenate two videos**  
To concatenate two videos, the video attributes (resolution, audio and video encoding format, etc.) must be consistent, without re-encoding.  

**快速串联两个视频**  
两个视频前后衔接，视频属性（分辨率、音视频编码格式等）必须一致  
```ts
import { fastConcatMP4 } from '@webav/av-cliper'

// return a ReadableStream, upload or save to disk
fastConcatMP4(
  await Promise.all([
    '<mp4 url 1>',
    '<mp4 url 2>',
  ].map(async url => (await fetch(url)).body!))
)
```

**Add animation to video**  
**给视频添加动画**  
```ts
import { Combinator, OffscreenSprite, MP4Clip } from '@webav/av-cliper'

const com = new Combinator({
  width: 1280,
  height: 720
})
const spr = new OffscreenSprite(
  'spr',
  new MP4Clip((await fetch('<mp4 url>')).body!)
)
await spr.ready
// 初始旋转 180°
spr.rect.angle = Math.PI
// 参考 css animation
spr.setAnimation(
  {
    from: { angle: Math.PI, x: 0, y: 0, opacity: 1 },
    to: { angle: Math.PI * 2, x: 300, y: 300, opacity: 0 }
  },
  { duration: 3 }
)
await com.add(spr)
// com.output() return a ReadableStream, upload or save to disk
```

**Dubbing the video**  
**视频配音**  
```ts
import { Combinator, OffscreenSprite, MP4Clip, AudioClip } from '@webav/av-cliper'

const com = new Combinator({
  // 画布大小，视频分辨率
  width: 1280,
  height: 720
})
const spr1 = new OffscreenSprite(
  'spr1',
  new MP4Clip((await fetch('<mp4 url>')).body!, {
    // 原视频消音
    audio: false
  })
)
const spr2 = new OffscreenSprite(
  'spr1',
  new AudioClip((await fetch('<mp3 url>')).body!, {
    loop: true
  })
)

await com.add(spr1, { main: true })
await com.add(spr2)
```

**video frame interceptor(eg: chromakey)**  
**视频帧拦截器(示例：绿幕抠图)**  
```ts
import { createChromakey } from '@webav/av-cliper'

const chromakey = createChromakey()
const clip = new MP4Clip((await fetch('./public/video/chromakey-test.mp4')).body!)
clip.tickInterceptor = async (_, tickRet) => {
  if (tickRet.video == null) return tickRet
  return {
    ...tickRet,
    video: await chromakey(tickRet.video)
  }
}
```

*images, subtitles are relatively simple, for examples please see the demo code, `. /demo/*.ts`*  
*图片、字幕相对简单，示例请查看demo代码，`./demo/*.ts`*  
