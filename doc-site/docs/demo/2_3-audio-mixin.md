---
nav: DEMO
group:
  title: 合成

order: 3
---

# 混音

混合两个音频文件，输出 mp4（无画面）。

```tsx
import { AudioClip, Combinator, OffscreenSprite } from '@webav/av-cliper';
import React, { useState } from 'react';
import { CombinatorPlay } from './combinator-player';

const resList = ['/audio/44.1kHz-2chan.m4a', '/audio/16kHz-1chan.mp3'];
async function start() {
  const audioSpr1 = new OffscreenSprite(
    'audioSpr1',
    new AudioClip((await fetch(resList[0])).body!, { volume: 0.5 }),
  );
  const audioSpr2 = new OffscreenSprite(
    'audioSpr2',
    new AudioClip((await fetch(resList[1])).body!),
  );

  const com = new Combinator({ width: 1280, height: 720 });
  await com.add(audioSpr1, { offset: 0, duration: 5 });
  await com.add(audioSpr2, { offset: 0, duration: 4 });
  return com;
}

export default function UI() {
  const [com, setCom] = useState<null | Combinator>(null);
  async function onStart() {
    const com = await start();
    setCom(com);
  }
  return (
    <CombinatorPlay list={resList} onStart={onStart} com={com}></CombinatorPlay>
  );
}
```

:::warning
`AudioClip` 内部使用了 `AudioContext` 解码音频文件，所以无法在 WebWorker 中工作。
:::
