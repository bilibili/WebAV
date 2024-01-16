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
import { MP4Previewer } from '@webav/av-cliper';
import { assetsPrefix } from './utils';

const videoSrc = assetsPrefix(['video/webav1.mp4']);

let previewer;
let mp4Info;
let mp4Dur;
async function start() {
  previewer = new MP4Previewer((await fetch(videoSrc)).body!);
  mp4Info = await previewer.getInfo();
  mp4Dur = Number((mp4Info.duration / mp4Info.timescale).toFixed(0));
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
                setImgSrc(await previewer.getImage(val));
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

:::info
如果只是为了绘制图像，使用视频帧更合适，`await previewer.getVideoFrame(time)`。

**注意**，视频帧使用完需要立即调用 `videoFrame.close()`
:::
