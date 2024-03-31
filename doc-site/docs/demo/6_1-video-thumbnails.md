---
nav: DEMO
group:
  title: 剪辑
  order: 2

order: 1
---

# 视频缩略图

视频缩略图常用于剪辑工具的时间轴模块中，该 DEMO 抽取视频所有关键帧，生成宽度 100px 的缩略图，并提供对应的时间戳。

```tsx
import { useState, useEffect } from 'react';
import { MP4Clip } from '@webav/av-cliper';
import { assetsPrefix } from './utils';

const resList = assetsPrefix(['video/bunny.mp4']);

async function start() {
  const clip = new MP4Clip((await fetch(resList[0])).body!);
  await clip.ready;
  return await clip.thumbnails();
}

export default function UI() {
  const [imgList, setImgList] = useState<Array<{ ts: number; img: string }>>(
    [],
  );
  const [cost, setCost] = useState(0);

  useEffect(() => {
    let startTime = performance.now();
    (async () => {
      setImgList(
        (await start()).map((it) => ({
          ts: it.ts,
          img: URL.createObjectURL(it.img),
        })),
      );
      setCost(((performance.now() - startTime) / 1000).toFixed(2));
    })();
  }, []);

  return (
    <>
      <div>
        {imgList.length === 0
          ? 'loading...'
          : `耗时：${cost}s，关键帧数：${imgList.length}`}
      </div>
      <br />
      <div className="flex flex-wrap">
        {imgList.map((it) => (
          <div key={it.ts}>
            <div className="text-center">{(it.ts / 1e6).toFixed(2)}s</div>
            <img src={it.img}></img>
          </div>
        ))}
      </div>
    </>
  );
}
```
