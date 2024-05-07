---
nav: DEMO
group:
  title: 合成

order: 2
---

# 视频配音

```tsx
import {
  AudioClip,
  Combinator,
  MP4Clip,
  OffscreenSprite,
} from '@webav/av-cliper';
import React, { useState } from 'react';
import { CombinatorPlay } from './combinator-player';
import { assetsPrefix } from './utils';

const resList = assetsPrefix(['video/webav1.mp4', 'audio/44.1kHz-2chan.mp3']);

async function start() {
  const videoSpr = new OffscreenSprite(
    new MP4Clip((await fetch(resList[0])).body!),
  );
  videoSpr.time.duration = 10e6;

  const audioSpr = new OffscreenSprite(
    new AudioClip((await fetch(resList[1])).body!, {
      loop: true,
    }),
  );
  const com = new Combinator({
    width: 1280,
    height: 720,
  });
  await com.add(videoSpr, { main: true });
  await com.add(audioSpr);
  return com;
}

export default function UI() {
  const [com, setCom] = useState<null | Combinator>(null);
  return (
    <CombinatorPlay
      list={resList}
      onStart={async () => setCom(await start())}
      com={com}
    ></CombinatorPlay>
  );
}
```

:::warning
`AudioClip` 内部使用了 `AudioContext` 解码音频文件，所以无法在 WebWorker 中工作。
:::

**动图配音生成视频**

```tsx
import {
  AudioClip,
  Combinator,
  ImgClip,
  OffscreenSprite,
} from '@webav/av-cliper';
import React, { useState } from 'react';
import { CombinatorPlay } from './combinator-player';
import { assetsPrefix } from './utils';

const resList = assetsPrefix(['img/animated.gif', 'audio/44.1kHz-2chan.m4a']);

async function start() {
  const gifSpr = new OffscreenSprite(
    new ImgClip({ type: 'image/gif', stream: (await fetch(resList[0])).body! }),
  );
  gifSpr.time = { duration: 10e6, offset: 0 };
  const audioSpr = new OffscreenSprite(
    new AudioClip((await fetch(resList[1])).body!),
  );
  audioSpr.time = { duration: 10e6, offset: 0 };
  const com = new Combinator({ width: 1280, height: 720 });
  await com.add(gifSpr);
  await com.add(audioSpr);
  return com;
}

export default function UI() {
  const [com, setCom] = useState<null | Combinator>(null);
  return (
    <CombinatorPlay
      list={resList}
      onStart={async () => setCom(await start())}
      com={com}
    ></CombinatorPlay>
  );
}
```
