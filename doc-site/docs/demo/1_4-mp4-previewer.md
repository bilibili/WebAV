---
nav: DEMO
group: 解码
order: 4
---

# 视频预览

从 MP4 文件中提取指定时间的图像，点击 Slider 预览任意时间点的图像；  
可用于实现视频截帧、视频 seek 预览等功能。

```tsx
import React, { useState, useEffect } from 'react';
import { Slider } from 'antd';
import { MP4Clip } from '@webav/av-cliper';
import { assetsPrefix } from './utils';

const videoSrc = assetsPrefix(['video/bunny_0.mp4']);

let clip;
let mp4Dur;
let convtr;
async function start() {
  clip = new MP4Clip((await fetch(videoSrc)).body!);
  const { duration, width, height } = await clip.ready;
  mp4Dur = Math.round(duration / 1e6);
  convtr = createVF2BlobConvtr(width, height);
}

// 将 VideoFrame 转换成 blob url，传递给 img src
function createVF2BlobConvtr(width: number, height: number) {
  const cvs = new OffscreenCanvas(width, height);
  const ctx = cvs.getContext('2d')!;

  return async (vf: VideoFrame | null) => {
    if (vf == null) return '';
    ctx.drawImage(vf, 0, 0, width, height);
    const pngBlob = await cvs.convertToBlob();
    vf.close();
    return URL.createObjectURL(pngBlob);
  };
}

export default function UI() {
  const [imgSrc, setImgSrc] = useState('');
  const [duration, setDuration] = useState(0);

  useEffect(() => {
    (async () => {
      await start();
      setDuration(mp4Dur);
    })();
  }, []);

  return (
    <div>
      {duration === 0 ? (
        'loading...'
      ) : (
        <div style={{ display: 'flex', alignItems: 'center' }}>
          <span> 时间：</span>
          <div style={{ flex: 1 }}>
            <Slider
              min={0}
              max={duration}
              step={0.1}
              onChange={async (val) => {
                setImgSrc(await convtr(await clip.getVideoFrame(val * 1e6)));
              }}
            />
          </div>
          <span>{duration}s</span>
        </div>
      )}
      {imgSrc && <img src={imgSrc} style={{ width: '100%' }} />}
    </div>
  );
}
```
