import { decodeImg } from '@webav/av-cliper';
import { Button, Radio } from 'antd';
import React, { useState } from 'react';

const imgs = {
  avif: '/img/animated.avif',
  webp: '/img/animated.webp',
  png: '/img/animated.png',
  gif: '/img/animated.gif',
};

let stopImg = () => {};
async function decode(ctx, imgType: keyof typeof imgs) {
  const frames = await decodeImg(
    (
      await fetch(imgs[imgType])
    ).body!,
    `image/${imgType}`,
  );

  stopImg();
  let i = 0;
  function render(vf: VideoFrame) {
    if (vf == null) return;
    ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
    ctx.drawImage(vf, 0, 0);

    const timer = setTimeout(() => {
      render(frames[++i]);
      vf.close();
    }, (vf.duration ?? 0) / 1000);

    stopImg = () => {
      clearTimeout(timer);
    };
  }
  render(frames[0]);
}

export default () => {
  const [imgType, setImgType] = useState('avif');

  const [ctx, setCtx] = useState<null | undefined | CanvasRenderingContext2D>(
    null,
  );

  return (
    <div>
      <Button
        onClick={() => {
          decode(ctx, imgType as keyof typeof imgs);
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
