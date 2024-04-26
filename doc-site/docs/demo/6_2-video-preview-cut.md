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

### 预览裁剪 MP4

```tsx
import React, { useState, useEffect } from 'react';
import { Slider, Button } from 'antd';
import { MP4Clip } from '@webav/av-cliper';
import { assetsPrefix } from './utils';

const videoSrc = assetsPrefix(['video/bunny_0.mp4']);

let clip;
let mp4Dur;
async function start() {
  clip = new MP4Clip((await fetch(videoSrc)).body!);
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
      <div className="flex items-center">
        <span>裁剪(deleteRange 已弃用)</span>
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

:::warning
示例中裁剪使用 `deleteRange` 方法已弃用，建议使用 `split` 按时间将素材切割成两份，实现裁剪功能。  
`split` 用法详情查看单测用例，未来得及更新 DEMO。
:::

### 预览 HLS（fmp4） 流

```tsx
import React, { useState, useEffect } from 'react';
import { Slider, Button } from 'antd';
import { MP4Clip, parseHLSStream } from '@webav/av-cliper';
import { assetsPrefix } from './utils';

const videoSrc = assetsPrefix(['video/m3u8/bunny.m3u8']);

let clip;
let mp4Dur;
async function start() {
  clip = new MP4Clip((await parseHLSStream(videoSrc[0]))[0]);
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
