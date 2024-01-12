# AVCliper

WebCodecs-based, combine video, audio, images, text, with animation support  
基于 WebCodecs 合成 视频、音频、图片、文字，支持动画

## Basic Concepts 基础概念

- `Combinator`: add `OffscreenSprite`, output video stream
  - Currently only supports outputting binary streams for MP4 format
- `IClip`: Abstract encapsulation of resources, reading (`IClip.tick(time)`) raw data of resources by time slice, has been implemented for the `IClip` interface with:
  - `MP4Clip, AudioClip, ImgClip, EmbedSubtitlesClip` (embedded SRT subtitles), these are the types of resources supported by `Combinator`
- `BaseSprite`: An abstract representation of manipulable elements, attaching Rect information (position, width, height, layer, animation) to resources to make them controllable.
  - `OffscreenSprite`: Wraps resources (`IClip`) and adds them to a `Combinator` for background offscreen video synthesis.
  - `AVCanvas`: Includes `VideoSprite, AudioSprite, ImgSprite, TextSprite` to support user or program control over the positioning of drawn resources.

<hr />

- `Combinator`： 视频合成器， add `OffscreenSprite`， output 视频流
  - 目前仅支持输出 MP4 格式的二进制流
- `IClip`： 资源的抽象封装，按时间片段读取（`IClip.tick(time)`）资源的原始数据，`IClip` 接口的实现类有：
  - `MP4Clip, AudioClip, ImgClip, EmbedSubtitlesClip`（内嵌 SRT 字幕），这些是合成视频所支持的资源类型
- `BaseSprite` 可操作元素的抽象，给资源附加 Rect（位置、宽高、层级、动画）信息，使得资源可被控制
  - `OffscreenSprite`： 包装资源（`IClip`）添加到 `Combinator`，在后台离屏合成视频
  - `AVCanvas` 包含了 `VideoSprite, AudioSprite, ImgSprite, TextSprite`，以支持用户或程序控制资源绘制的位置

## DEMO

<https://hughfenghen.github.io/WebAV/demo/>
