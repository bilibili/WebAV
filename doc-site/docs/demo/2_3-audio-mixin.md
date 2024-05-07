---
nav: DEMO
group:
  title: 合成

order: 3
---

# 音频合成

## 混音

混合两个音频文件，输出 m4a 音频文件。

`new Combiator` 不提供 `width, height` 或任意一个值为 0，则不会创建视频轨道，生成的是 m4a 音频文件。

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
`AudioClip` 内部使用了 `AudioContext` 解码音频文件，所以无法在 WebWorker 中工作。
:::

## 拼接音频

将两个音频文件首尾相连，输出 m4a 音频文件。

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
