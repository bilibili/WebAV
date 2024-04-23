---
nav: DEMO
group:
  title: 剪辑
  order: 2

order: 3
---

# 轨道分离

将一个视频素材拆分成独立的视频、音频素材，这样就能单独操作或丢弃对应的素材轨道。  
持有独立音频视频素材，可轻易实现以下功能

1. 单独裁剪素材，互不影响
2. `Combinator` 合成视频，添加（`add`）素材时将画面与音频错位（使用不同的 `offset`）
3. 视频静音，或丢弃画面只保留声音

下面演示拆分一个视频文件，允许独立播放该文件音频与视频。

```tsx
import React, { useState, useEffect } from 'react';
import { Slider, Button } from 'antd';
import { MP4Clip } from '@webav/av-cliper';
import { assetsPrefix } from './utils';

const videoSrc = assetsPrefix(['video/bunny_0.mp4']);

let videoClip;
let audioTrackClip;
async function start() {
  const clip = new MP4Clip((await fetch(videoSrc)).body!);
  await clip.ready;
  [videoClip, audioTrackClip] = await clip.splitTrack();
}

let videoTimer = 0;
function playVideo(ctx) {
  let startTime = performance.now();

  stopAudio();
  stopVideo();
  videoTimer = setInterval(async () => {
    const { state, video } = await videoClip.tick(
      Math.round((performance.now() - startTime) * 1000),
    );
    if (state === 'done') {
      clearInterval(videoTimer);
      return;
    }
    if (video != null && state === 'success') {
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.drawImage(video, 0, 0, ctx.canvas.width, ctx.canvas.height);
      video.close();
    }
  }, 1000 / 30);
}

function stopVideo() {
  clearInterval(videoTimer);
}

const audioCtx = new AudioContext();
let audioSource, audioTimer;
async function playAudio() {
  // 当前片段的开始播放的时间
  let startAt = 0;
  let startTime = performance.now();

  stopAudio();
  stopVideo();
  audioTimer = setInterval(async () => {
    const { state, audio } = await audioTrackClip.tick(
      Math.round((performance.now() - startTime) * 1000),
    );
    if (state === 'done') {
      clearInterval(audioTimer);
      return;
    }
    const len = audio?.[0]?.length ?? 0;
    if (len === 0) return;
    const buf = audioCtx.createBuffer(2, len, 48000);
    buf.copyToChannel(audio[0], 0);
    buf.copyToChannel(audio[1], 1);
    audioSource = audioCtx.createBufferSource();
    audioSource.buffer = buf;
    audioSource.connect(audioCtx.destination);
    startAt = Math.max(audioCtx.currentTime, startAt);
    audioSource.start(startAt);

    startAt += buf.duration;
  }, 1000 / 30);
}
function stopAudio() {
  audioSource?.stop();
  clearInterval(audioTimer);
}

export default function UI() {
  const [ctx, setCtx] = useState<null | undefined | CanvasRenderingContext2D>();

  useEffect(() => {
    (async () => {
      if (ctx == null) return;
      await start();
    })();
  }, [ctx]);

  return (
    <div>
      <div className="flex items-center">
        <Button
          onClick={() => {
            playVideo(ctx);
          }}
        >
          播放视频
        </Button>{' '}
        ｜
        <Button
          onClick={() => {
            playAudio();
          }}
        >
          播放音频
        </Button>
      </div>
      <canvas
        className="w-full"
        width={900}
        height={500}
        ref={(c) => {
          setCtx(c?.getContext('2d'));
        }}
      />
    </div>
  );
}
```
