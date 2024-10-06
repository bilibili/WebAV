---
nav: DEMO
group:
  title: Clip
  order: 2
order: 1
---

# Thumbnail

Video thumbnails are often used in the timeline module of editing tools. This DEMO extracts all key frames of a video, generates a thumbnail with a default width of 100px (customizable), and provides the corresponding timestamp.

```tsx
import { useState, useEffect } from 'react';
import { MP4Clip } from '@webav/av-cliper';
import { assetsPrefix } from './utils';

const resList = assetsPrefix(['video/bunny.mp4']);

async function start() {
  const clip = new MP4Clip((await fetch(resList[0])).body!);
  await clip.ready;
  let t = performance.now();
  const imgList = await clip.thumbnails();
  const cost = ((performance.now() - t) / 1000).toFixed(2);
  return {
    imgList,
    cost,
  };
}

export default function UI() {
  const [imgList, setImgList] = useState<Array<{ ts: number; img: string }>>(
    [],
  );
  const [cost, setCost] = useState(0);

  useEffect(() => {
    (async () => {
      const { imgList, cost } = await start();
      setImgList(
        imgList.map((it) => ({
          ts: it.ts,
          img: URL.createObjectURL(it.img),
        })),
      );
      setCost(cost);
    })();
  }, []);

  return (
    <>
      <div>
        {imgList.length === 0
          ? 'loading...'
          : `Time：${cost}s，Number of key frames：${imgList.length}`}
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

## Custom: time interval, step size, and image width

Specify the video time interval and step size (in **microseconds**) to obtain video image frames for scenarios that need to display more detailed image frames. For example, the video editing timeline component zooms in to show more frames.

Setting the step size small enough (e.g. 10ms`step: 10e3`) is the same as looking at all frames for a given time interval.
:::info
The time interval should not be too large to avoid taking too long to generate thumbnails.
:::

The DEMO will take a frame from a video every 1 second between 10s and 20s, with a thumbnail width of 200px.

```tsx
import { useState, useEffect } from 'react';
import { MP4Clip } from '@webav/av-cliper';
import { assetsPrefix } from './utils';

const resList = assetsPrefix(['video/bunny.mp4']);

async function start() {
  const clip = new MP4Clip((await fetch(resList[0])).body!);
  await clip.ready;
  let t = performance.now();
  const imgList = await clip.thumbnails(200, {
    start: 10e6,
    end: 20e6,
    step: 1e6,
  });
  const cost = ((performance.now() - t) / 1000).toFixed(2);
  return {
    imgList,
    cost,
  };
}

export default function UI() {
  const [imgList, setImgList] = useState<Array<{ ts: number; img: string }>>(
    [],
  );
  const [cost, setCost] = useState(0);

  useEffect(() => {
    (async () => {
      const { imgList, cost } = await start();
      setImgList(
        imgList.map((it) => ({
          ts: it.ts,
          img: URL.createObjectURL(it.img),
        })),
      );
      setCost(cost);
    })();
  }, []);

  return (
    <>
      <div>
        {imgList.length === 0
          ? 'loading...'
          : `Time: ${cost}s， Number of extracted frames：${imgList.length}`}
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

:::info
The "Time" in DEMO includes the consumption of decoding video frames + encoding thumbnails, excluding the time consumed by network loading video resources.
:::
