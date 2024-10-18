import { ImgClip } from '@webav/av-cliper';
import { Button, Radio } from 'antd';
import { useState } from 'react';
import { assetsPrefix } from './utils';

const imgs = assetsPrefix({
  avif: 'img/animated.avif',
  webp: 'img/animated.webp',
  png: 'img/animated.png',
  gif: 'img/animated.gif',
});

let stopRender = () => {};
async function start(
  ctx: CanvasRenderingContext2D,
  imgType: keyof typeof imgs,
) {
  const clip = new ImgClip({
    type: `image/${imgType}`,
    stream: (await fetch(imgs[imgType])).body!,
  });
  await clip.ready;
  stopRender();
  function render() {
    let startTime = performance.now();
    const timer = setInterval(async () => {
      const { video } = await clip.tick((performance.now() - startTime) * 1000);
      if (video != null) {
        ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
        ctx.drawImage(video, 0, 0);
        video.close();
      }
    }, 1000 / 30);

    stopRender = () => {
      clip.destroy();
      clearInterval(timer);
    };
  }
  render();
}

export default createUI(start);

// ---------- 以下是 UI 代码 ---------------

function createUI(start: Function) {
  return () => {
    const [imgType, setImgType] = useState('avif');

    const [ctx, setCtx] = useState<null | undefined | CanvasRenderingContext2D>(
      null,
    );

    return (
      <div>
        <Button
          onClick={() => {
            start(ctx, imgType as keyof typeof imgs);
          }}
        >
          启动！
        </Button>
        <br />
        <Radio.Group
          onChange={(e) => {
            setImgType(e.target.value);
          }}
          value={imgType}
        >
          <Radio value="avif">avif</Radio>
          <Radio value="webp">webp</Radio>
          <Radio value="png">png</Radio>
          <Radio value="gif">gif</Radio>
        </Radio.Group>
        <br />
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
