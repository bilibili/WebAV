# AVCliper

WebCodecs-based, combine video, audio, images, text, with animation support  
基于 WebCodecs 合成 视频、音频、图片、文字，支持动画

## Basic Concepts 基础概念

- `Combinator`: add `OffscreenSprite`, output video stream
  - Currently only supports outputting binary streams for MP4,AAC format
- `OffscreenSprite`: wraps the resource (Clip), attaching Rect (position, width, height, animation) information to the resource so that it can be drawn to the Canvas
- `IClip`: Abstract encapsulation of resources, reading (`IClip.tick(time)`) raw data of resources by time slice, has been implemented for the `IClip` interface with:
  - `MP4Clip, AudioClip, ImgClip, EmbedSubtitlesClip` (embedded SRT subtitles), these are the types of resources supported by `Combinator`

<hr />

- `Combinator`： 视频合成器， add `OffscreenSprite`， output 视频流
  - 目前仅支持输出 MP4,AAC 格式的二进制流
- `OffscreenSprite`： 包装资源（Clip），给资源附加 Rect（位置、宽高、动画）信息，使得资源可被绘制到 Canvas 上
- `IClip`： 资源的抽象封装，按时间片段读取（`IClip.tick(time)`）资源的原始数据，已实现 `IClip` 接口的有：
  - `MP4Clip, AudioClip, ImgClip, EmbedSubtitlesClip`（内嵌 SRT 字幕），这些是合成视频所支持的资源类型

## Demo

<https://hughfenghen.github.io/WebAV/demo/1_1-decode-video>
