---
nav: DEMO
group:
  title: 剪辑
  order: 2

order: 1
---

# 视频缩略图

视频缩略图常用于剪辑工具的时间轴模块中，该 DEMO 抽取视频所有关键帧，生成默认宽度 100px（可自定义）的缩略图，并提供对应的时间戳。

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

## 自定义步长

可以通过指定视频时间段、步长（单位微秒）来获取视频帧。该 DEMO 从视频 10s - 60s 之间每隔 10s 抽取一帧。

```tsx
import { useState, useEffect } from 'react';
import { MP4Clip } from '@webav/av-cliper';
import { assetsPrefix } from './utils';

const resList = assetsPrefix(['video/bunny.mp4']);

async function start() {
  const clip = new MP4Clip((await fetch(resList[0])).body!);
  await clip.ready;
  return await clip.thumbnails(200, { start: 10e6, end: 60e6, step: 10e6 });
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
          : `耗时：${cost}s，提取帧数：${imgList.length}`}
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
