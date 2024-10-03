---
nav:
  title: Guide
  order: 2
group:
  title: Start
  order: 3
order: 1
---

# Packages Introduction

### [av-cliper](https://bilibili.github.io/WebAV/_api/av-cliper/)

`av-cliper` is a basic SDK for audio and video data processing. It provides some basic classes or functions to help developers quickly achieve their goals.

Here's a quick overview of the core API of `av-cliper`

- `IClip` is an abstraction of audio and video assets. It parses audio and video assets, images, captions, and feeds data to other modules
- `Sprite<IClip>` adds space and time attributes to the material, which is used to control the spatial position and time offset of the video in the material, and realize multi-material collaboration, animation and other functions
- A `Combinator` can add multiple Sprites and combine them into a video file based on their position, level, time offset, etc
<details>
<summary style="cursor: pointer;"> Code demo: Add a moving translucent watermark to the video</summary>

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

### [av-canvas](https://bilibili.github.io/WebAV/_api/av-canvas/)

`av-canvas` relies on the basic capabilities of `av-cliper` to provide a canvas that responds to user actions on Sprite (drag, zoom, rotate), which is used to quickly implement products such as video clips, live streaming streaming workstations, etc.

<details>
<summary style="cursor: pointer;">Code demo: Add video and text to the canvas</summary>

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

### [av-recorder](https://bilibili.github.io/WebAV/_api/av-canvas/)

`av-recorder` records `MediaStream` and outputs video file stream in MP4 format.

<details>
<summary style="cursor: pointer;"> Code demo: Record camera, microphone, output MP4 file stream.</summary>

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
