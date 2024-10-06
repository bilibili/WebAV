---
nav: DEMO
group:
  title: decode
  order: 2
order: 4
---

# Decode and Play

Using `WebCodecs + canvas + Web Audio` to decode and play video, the original image and audio data of the video can be obtained.

This gives you the most complete playback control you can get with a native `video` tag, such as:

- buffer control for low-latency scenarios.
- Drop frames based on device pressure conditions.
- Automatic recovery when decoding exception.
- Play frame by frame, super fast double speed play.
- Play audio at double speed without scaling
- Custom playback FPS.

The **cost** of this solution is complexity, and using `video` should be preferred unless you can't meet your needs.

### Play MP4

<code src="./play-mp4.tsx"></code>

### Play HLS（fmp4）Stream

```tsx
import React, { useState, useEffect } from 'react';
import { Slider, Button } from 'antd';
import { MP4Clip, createHLSLoader } from '@webav/av-cliper';
import { assetsPrefix } from './utils';

const videoSrc = assetsPrefix(['video/m3u8/bunny.m3u8']);

let clip;
let mp4Dur;
async function start() {
  const hlsLoader = await createHLSLoader(videoSrc[0]);

  const [{ stream }] = hlsLoader.load();
  clip = new MP4Clip(stream);
  const { duration, width, height } = await clip.ready;
  mp4Dur = Math.round(duration / 1e6);
}

let timer;
const audioCtx = new AudioContext();
let audioSource;
function play(ctx, initTime, updateTime) {
  let curTime = initTime;
  let startAt = 0;
  let first = true;

  stop();
  timer = setInterval(async () => {
    const { state, video, audio } = await clip.tick(Math.round(curTime));
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

    if (first) {
      // 首次播放丢弃当前音频数据
      // 比如 seek 到 10s，播放的音频数据应该是从第 10s 开始，需要丢弃前面音频数据
      first = false;
      return;
    }

    const len = audio[0]?.length ?? 0;
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

function stop() {
  audioSource?.stop();
  clearInterval(timer);
}

export default function UI() {
  const [curTime, setCurTime] = useState(0);
  const [duration, setDuration] = useState(0);
  const [ctx, setCtx] = useState<null | undefined | CanvasRenderingContext2D>();
  const [playing, setPlaying] = useState(false);

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
    stop();
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
          <span className="mx-4">{duration}s</span>
          <Button
            onClick={() => {
              if (playing) {
                stop();
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
    </div>
  );
}
```
