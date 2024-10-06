---
nav: DEMO
group:
  title: Composite

order: 3
---

# Audio Composite

## Sound Mixing

Mix two audio files and output m4a audio file.

If `new Combiator` does not provide a `width, height` or any value of 0, then no video track will be created and an m4a audio file will be generated.

```tsx
import { AudioClip, Combinator, OffscreenSprite } from '@webav/av-cliper';
import React, { useState } from 'react';
import { CombinatorPlay } from './combinator-player';
import { assetsPrefix } from './utils';

const resList = assetsPrefix([
  'audio/44.1kHz-2chan.m4a',
  'audio/16kHz-1chan.mp3',
]);
async function start() {
  const audioSpr1 = new OffscreenSprite(
    new AudioClip((await fetch(resList[0])).body!, { volume: 0.5 }),
  );
  audioSpr1.time = { offset: 0, duration: 5e6 };
  const audioSpr2 = new OffscreenSprite(
    new AudioClip((await fetch(resList[1])).body!),
  );
  audioSpr2.time = { offset: 0, duration: 4e6 };

  const com = new Combinator();
  await com.addSprite(audioSpr1);
  await com.addSprite(audioSpr2);
  return com;
}

export default function UI() {
  const [com, setCom] = useState<null | Combinator>(null);
  return (
    <CombinatorPlay
      list={resList}
      onStart={async () => setCom(await start())}
      com={com}
      mediaType="audio"
    ></CombinatorPlay>
  );
}
```

:::warning
`AudioClip` internally uses`AudioContext`to decode audio files, so it won't work in WebWorkers.
:::

## Splicing Audio

Concatenate the two audio files end to end to output the m4a audio file.

```tsx
import {
  AudioClip,
  Combinator,
  OffscreenSprite,
  concatAudioClip,
} from '@webav/av-cliper';
import React, { useState } from 'react';
import { CombinatorPlay } from './combinator-player';
import { assetsPrefix } from './utils';

const resList = assetsPrefix([
  'audio/16kHz-1chan.mp3',
  'audio/44.1kHz-2chan.m4a',
]);
async function start() {
  const clip = await concatAudioClip(
    await Promise.all(
      resList.map(async (url) => new AudioClip((await fetch(url)).body!)),
    ),
  );
  const audioSpr = new OffscreenSprite(clip);
  audioSpr.time = { offset: 0, duration: 30e6 };

  const com = new Combinator();
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
      mediaType="audio"
    ></CombinatorPlay>
  );
}
```
