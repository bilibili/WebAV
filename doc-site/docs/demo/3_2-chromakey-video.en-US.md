---
nav: DEMO
group:
  title: Green screen matting

order: 2
---

# Video Background

Overlay two videos on top of the background image, the original video on the left and the effect after removing the green screen background on the right.

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
import { assetsPrefix } from './utils';

const resList = assetsPrefix(['video/chromakey-test.mp4', 'img/bunny.png']);

const chromakey = createChromakey({
  // Unset keyColor defaults to the color of the first pixel in the top-left corner
  // keyColor: '#00FF00'
  similarity: 0.33,
  smoothness: 0.1,
  spill: 0.1,
});

async function start() {
  const width = 1280;
  const height = 720;

  const originSpr = new OffscreenSprite(
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

  const targetSpr = new OffscreenSprite(targetClip);
  await targetSpr.ready;
  targetSpr.zIndex = 1;
  targetSpr.rect.x = originSpr.rect.x + targetSpr.rect.w + 100;
  targetSpr.rect.y = (height - targetSpr.rect.h) / 2;

  const bgImgSpr = new OffscreenSprite(
    new ImgClip(
      await createImageBitmap(await (await fetch(resList[1])).blob()),
    ),
  );

  const com = new Combinator({ width, height, bgColor: 'white' });

  await com.addSprite(originSpr, { main: true });
  await com.addSprite(targetSpr);
  await com.addSprite(bgImgSpr);
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

The implementation principle refers to the article:[WebGL Chromakey real-time green matting](https://hughfenghen.github.io/posts/2023/07/07/webgl-chromakey/)
