---
nav:
  title: 指南
  order: 2
group:
  title: 开始
order: 3
---

# 模块介绍

### [av-cliper](https://webav-tech.github.io/WebAV/_api/av-cliper/)

`av-cliper` 是音视频数据处理的基础 SDK，它提供了一些基础 class 或 function 帮助开发者快速实现目标功能。

这里简要介绍 `av-cliper` 的核心 API

- `IClip` 是音视频素材的抽象，解析音视频、图片、字幕资源，给其他模块提供数据
- `Sprite<IClip>` 给素材附加空间、时间属性，用于控制素材中视频的空间位置、时间偏移，实现多素材协作、动画等功能
- `Combinator` 能添加多个 Sprite，根据它们位置、层级、时间偏移等信息，合成输出为视频文件

<details>
<summary style="cursor: pointer;"> 代码演示：给视频添加一个移动的半透明水印 </summary>

```js
import {
  ImgClip,
  MP4Clip,
  OffscreenSprite,
  renderTxt2ImgBitmap,
  Combinator,
} from '@webav/av-cliper';

const spr1 = new OffscreenSprite(
  new MP4Clip((await fetch('./video/bunny.mp4')).body),
);
const spr2 = new OffscreenSprite(
  new ImgClip(
    await renderTxt2ImgBitmap(
      '水印',
      `font-size:40px; color: white; text-shadow: 2px 2px 6px red;`,
    ),
  ),
);
spr2.time = { offset: 0, duration: 5e6 };
spr2.setAnimation(
  {
    '0%': { x: 0, y: 0 },
    '25%': { x: 1200, y: 680 },
    '50%': { x: 1200, y: 0 },
    '75%': { x: 0, y: 680 },
    '100%': { x: 0, y: 0 },
  },
  { duration: 4e6, iterCount: 1 },
);
spr2.zIndex = 10;
spr2.opacity = 0.5;

const com = new Combinator({
  width: 1280,
  height: 720,
});

await com.addSprite(spr1);
await com.addSprite(spr2);

com.output(); // => ReadableStream
```

</details>

### [av-canvas](https://webav-tech.github.io/WebAV/_api/av-canvas/)

`av-canvas` 依赖 `av-cliper` 的基础能力，提供一个画布响应用户对 Sprite 的操作（拖拽、缩放、旋转），用于快速实现视频剪辑、直播推流工作台等产品。

<details>
<summary style="cursor: pointer;"> 代码演示：向画布中添加视频与文字 </summary>

```js
import {
  ImgClip,
  MP4Clip,
  VisibleSprite,
  renderTxt2ImgBitmap,
} from '@webav/av-cliper';
import { AVCanvas } from '@webav/av-canvas';

const avCvs = new AVCanvas(document.querySelector('#app'), {
  width: 1280,
  height: 720,
});

const spr1 = new VisibleSprite(
  new MP4Clip((await fetch('./video/bunny.mp4')).body),
);
const spr2 = new VisibleSprite(
  new ImgClip(
    await renderTxt2ImgBitmap(
      '水印',
      `font-size:40px; color: white; text-shadow: 2px 2px 6px red;`,
    ),
  ),
);

await avCvs.add(spr1);
await avCvs.add(spr2);
```

</details>

### [av-recorder](https://webav-tech.github.io/WebAV/_api/av-recorder/)

`av-recorder` 录制 `MediaStream` 输出 MP4 格式的视频文件流。

<details>
<summary style="cursor: pointer;"> 代码演示：录制摄像头、麦克风，输出 MP4 文件流 </summary>

```js
import { AVRecorder } from '@webav/av-recorder';
const mediaStream = await navigator.mediaDevices.getUserMedia({
  video: true,
  audio: true,
});

const recorder = new AVRecorder(recodeMS);
recorder.start(); // => ReadableStream
```

</details>
