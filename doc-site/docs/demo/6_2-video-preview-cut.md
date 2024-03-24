---
nav: DEMO
group:
  title: 剪辑
  order: 2

order: 2
---

# 裁剪预览

预览画面、裁剪片段是最基础的视频剪辑操作；  
点击时间轴预览任意时刻的视频帧；选择时间区间，移除不想要的视频片段。

```tsx
import React, { useState, useEffect } from 'react';
import { Slider, Button } from 'antd';
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

let timer;
function play(ctx, initTime, updateTime) {
  let curTime = initTime;

  clearInterval(timer);
  timer = setInterval(async () => {
    const { state, video } = await clip.tick(Math.round(curTime));
    curTime += (1000 / 30) * 1000;
    updateTime(curTime);
    if (state === 'done') {
      clearInterval(timer);
      return;
    }
    if (video != null && state === 'success') {
      ctx.clearRect(0, 0, 900, 500);
      ctx.drawImage(video, 0, 0, 900, 500);
      video.close();
    }
  }, 1000 / 30);
}

export default function UI() {
  const [curTime, setCurTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [ctx, setCtx] = useState<null | undefined | CanvasRenderingContext2D>();
  const [playing, setPlaying] = useState(false);
  const [cutRange, setCutRange] = useState([5, 10]);

  useEffect(() => {
    (async () => {
      if (ctx == null) return;
      await start();
      setDuration(mp4Dur);
      preview(0.5);
    })();
  }, [ctx]);

  async function preview(val) {
    setPlaying(false);
    clearInterval(timer);
    setCurTime(val);
    const time = val * 1e6;
    console.log('preview time:', time);
    const { video } = await clip.tick(time);
    if (video != null) {
      ctx.drawImage(video, 0, 0, 900, 500);
      video.close();
    }
  }

  return (
    <div>
      {duration === 0 ? (
        'loading...'
      ) : (
        <div className="flex items-center">
          <span>预览</span>
          <div className="flex-1 ml-4">
            <Slider
              min={0}
              max={duration}
              step={0.1}
              value={curTime}
              onChange={preview}
            />
          </div>
          <span className="mr-4">{duration}s</span>
          <Button
            onClick={() => {
              if (playing) {
                clearInterval(timer);
              } else {
                console.log(curTime);
                play(ctx, curTime * 1e6, (playTime) => {
                  setCurTime(playTime / 1e6);
                });
              }
              setPlaying(!playing);
            }}
          >
            {playing ? '暂停' : '播放'}
          </Button>
        </div>
      )}
      <canvas
        className="w-full"
        width={900}
        height={500}
        ref={(c) => {
          setCtx(c?.getContext('2d'));
        }}
      />
      <div className="flex items-center">
        <span>裁剪</span>
        <div className="flex-1 ml-4">
          <Slider
            range
            min={0}
            max={duration}
            defaultValue={cutRange}
            step={0.1}
            onChange={async (val) => {
              setCutRange(val);
            }}
          />
        </div>
        <span className="mr-4">{duration}s</span>
        <Button
          onClick={() => {
            console.log(cutRange.map((v) => v * 1e6));
            clip.deleteRange(...cutRange.map((v) => v * 1e6));
            setDuration(Math.round(clip.meta.duration / 1e6));
          }}
        >
          删除
        </Button>
      </div>
    </div>
  );
}
```
