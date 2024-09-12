---
nav: DEMO
group:
  title: Clip
  order: 2

order: 3
---

# Orbit Separation

Audio and video track separation is a basic ability of editing. After separation, audio and video tracks can be edited separately without affecting each other.

The DEMO demo will split a video file into independent audio and video, support independent playback.

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
  // The start time of the current segment
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
          play video
        </Button>{' '}
        ｜
        <Button
          onClick={() => {
            playAudio();
          }}
        >
          play audio
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
