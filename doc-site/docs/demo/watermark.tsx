import {
  Combinator,
  ImgClip,
  MP4Clip,
  OffscreenSprite,
  renderTxt2ImgBitmap,
} from '@webav/av-cliper';
import React, { useState } from 'react';
import { CombinatorPlay } from './combinator-player';

const resList = ['/video/webav1.mp4'];

async function start() {
  const spr1 = new OffscreenSprite(
    'spr1',
    new MP4Clip((await fetch(resList[0])).body!),
  );

  const spr2 = new OffscreenSprite(
    'spr2',
    new ImgClip(
      await renderTxt2ImgBitmap(
        '水印',
        `font-size:40px; color: white; text-shadow: 2px 2px 6px red;`,
      ),
    ),
  );
  spr2.setAnimation(
    {
      '0%': { x: 0, y: 0 },
      '25%': { x: 1200, y: 680 },
      '50%': { x: 1200, y: 0 },
      '75%': { x: 0, y: 680 },
      '100%': { x: 0, y: 0 },
    },
    { duration: 4, iterCount: 1 },
  );
  spr2.zIndex = 10;
  spr2.opacity = 0.5;

  const com = new Combinator({
    width: 1280,
    height: 720,
    bgColor: 'white',
  });

  await com.add(spr1, { main: true });
  await com.add(spr2, { offset: 0, duration: 5 });
  return com;
}

export default function UI() {
  const [com, setCom] = useState<null | Combinator>(null);
  return (
    <CombinatorPlay
      list={resList}
      onStart={async () => setCom(await start())}
      com={com}
    ></CombinatorPlay>
  );
}
