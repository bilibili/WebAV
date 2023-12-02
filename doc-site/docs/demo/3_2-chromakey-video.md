---
nav: DEMO
group:
  title: 绿幕抠图
  order: 3

order: 2
---

# 视频背景

在背景图上叠加两个视频，左边是原视频，右边是移除绿幕背景后的效果。

```tsx
import {
  Combinator,
  ImgClip,
  MP4Clip,
  OffscreenSprite,
  createChromakey,
} from '@webav/av-cliper';
import React, { useState } from 'react';
import { CombinatorPlay } from './combinator-player';

const resList = ['/video/chromakey-test.mp4', '/img/bunny.png'];

const chromakey = createChromakey({
  similarity: 0.4,
  smoothness: 0.1,
  spill: 0.1,
});

async function start() {
  const width = 1280;
  const height = 720;

  const originSpr = new OffscreenSprite(
    'originSpr',
    new MP4Clip((await fetch(resList[0])).body!),
  );
  await originSpr.ready;
  originSpr.zIndex = 1;
  originSpr.rect.x = (width - originSpr.rect.w * 2 - 100) / 2;
  originSpr.rect.y = (height - originSpr.rect.h) / 2;

  const targetClip = new MP4Clip((await fetch(resList[0])).body!);
  targetClip.tickInterceptor = async (_, tickRet) => {
    if (tickRet.video == null) return tickRet;
    return {
      ...tickRet,
      video: await chromakey(tickRet.video),
    };
  };

  const targetSpr = new OffscreenSprite('targetSpr', targetClip);
  await targetSpr.ready;
  targetSpr.zIndex = 1;
  targetSpr.rect.x = originSpr.rect.x + targetSpr.rect.w + 100;
  targetSpr.rect.y = (height - targetSpr.rect.h) / 2;

  const bgImgSpr = new OffscreenSprite(
    'bgImgSpr',
    new ImgClip(
      await createImageBitmap(await (await fetch(resList[1])).blob()),
    ),
  );

  const com = new Combinator({ width, height, bgColor: 'white' });

  await com.add(originSpr, { main: true });
  await com.add(targetSpr);
  await com.add(bgImgSpr);
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
