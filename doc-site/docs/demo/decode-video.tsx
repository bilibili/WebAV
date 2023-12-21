import { MP4Clip } from '@webav/av-cliper';
import { Button, Divider, Radio } from 'antd';
import React, { useState } from 'react';
import { assetsPrefix } from './utils';

const videos = assetsPrefix({
  'bunny.mp4': 'video/bunny-avc.mp4',
  'bear.mp4': 'video/bear-vp9.mp4',
});

async function start(
  speed: number,
  videoType: keyof typeof videos,
  ctx: CanvasRenderingContext2D,
) {
  const resp1 = await fetch(videos[videoType]);
  const clip = new MP4Clip(resp1.body!);
  await clip.ready;

  if (speed === Infinity) {
    fastestDecode();
  } else {
    timesSpeedDecode(speed);
  }

  async function fastestDecode() {
    let time = 0;
    while (true) {
      const { state, video } = await clip.tick(time);
      if (state === 'done') break;
      if (video != null && state === 'success') {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.drawImage(
          video,
          0,
          0,
          video.codedWidth,
          video.codedHeight,
          0,
          0,
          ctx.canvas.width,
          ctx.canvas.height,
        );
        video.close();
      }
      time += 33000;
    }
    clip.destroy();
  }

  function timesSpeedDecode(times: number) {
    let startTime = performance.now();

    const timer = setInterval(async () => {
      const { state, video } = await clip.tick(
        Math.round((performance.now() - startTime) * 1000) * times,
      );
      if (state === 'done') {
        clearInterval(timer);
        clip.destroy();
        return;
      }
      if (video != null && state === 'success') {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.drawImage(
          video,
          0,
          0,
          video.codedWidth,
          video.codedHeight,
          0,
          0,
          ctx.canvas.width,
          ctx.canvas.height,
        );
        video.close();
      }
    }, 1000 / 30);
  }
}

export default createUI(start);

// ---------- 以下是 UI 代码 ---------------

function createUI(start: Function) {
  return () => {
    const [value, setValue] = useState('bunny.mp4');
    const [speed, setSpeed] = useState(Infinity);
    const [ctx, setCtx] = useState<null | undefined | CanvasRenderingContext2D>(
      null,
    );
    return (
      <div>
        <Button
          onClick={() => {
            start(speed, value as keyof typeof videos, ctx);
          }}
        >
          启动！
        </Button>
        <br />
        <Radio.Group
          onChange={(e) => {
            setValue(e.target.value);
          }}
          value={value}
        >
          <Radio value="bunny.mp4">bunny.mp4</Radio>
          <Radio value="bear.mp4">bear.mp4</Radio>
        </Radio.Group>
        <Divider type="vertical"></Divider>{' '}
        <Radio.Group
          onChange={(e) => {
            setSpeed(e.target.value);
          }}
          value={speed}
        >
          <Radio value={Infinity}>最快</Radio>
          <Radio value={3}>3 倍速</Radio>
          <Radio value={1}>1 倍速</Radio>
        </Radio.Group>
        <br></br>
        <canvas
          width={600}
          height={333}
          ref={(c) => {
            setCtx(c?.getContext('2d'));
          }}
        />
      </div>
    );
  };
}
