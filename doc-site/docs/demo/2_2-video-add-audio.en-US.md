---
nav: DEMO
group:
  title: Composite
order: 2
---

# Video Dubbing

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
  await com.addSprite(videoSpr, { main: true });
  await com.addSprite(audioSpr);
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
`AudioClip` internally uses' AudioContext 'to decode audio files, so it won't work in WebWorkers.
:::

**GIF dubbing to generate video**

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
  await com.addSprite(gifSpr);
  await com.addSprite(audioSpr);
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
