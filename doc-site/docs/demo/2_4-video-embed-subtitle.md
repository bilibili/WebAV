---
nav: DEMO
group:
  title: 合成

order: 4
---

# 嵌入字幕

在视频中嵌入 SRT 字幕。

```tsx
import {
  MP4Clip,
  EmbedSubtitlesClip,
  Combinator,
  OffscreenSprite,
} from '@webav/av-cliper';
import React, { useState } from 'react';
import { CombinatorPlay } from './combinator-player';

const resList = ['/video/webav1.mp4', '/subtitles/test-sample.srt'];
async function start() {
  const videoSpr = new OffscreenSprite(
    'videoSpr',
    new MP4Clip((await fetch(resList[0])).body!),
  );
  const srtSpr = new OffscreenSprite(
    'srtSpr',
    new EmbedSubtitlesClip(await (await fetch(resList[1])).text(), {
      videoWidth: 1280,
      videoHeight: 720,
      fontSize: 44,
      fontFamily: 'Noto Sans SC',
      strokeStyle: '#000',
      lineWidth: 20,
      lineJoin: 'round',
      lineCap: 'round',
      textShadow: {
        offsetX: 2,
        offsetY: 2,
        blur: 4,
        color: 'rgba(0,0,0,0.25)',
      },
    }),
  );
  const com = new Combinator({ width: 1280, height: 720 });
  await com.add(videoSpr, { duration: 10, offset: 0 });
  await com.add(srtSpr, { duration: 10, offset: 0 });
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
