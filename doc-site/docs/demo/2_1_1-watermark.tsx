import {
  Combinator,
  ImgClip,
  MP4Clip,
  OffscreenSprite,
  renderTxt2ImgBitmap,
} from '@webav/av-cliper';
import { useState } from 'react';
import { Slider } from 'antd';
import { CombinatorPlay } from './combinator-player';
import { assetsPrefix } from './utils';

const resList = assetsPrefix(['video/webav1.mp4']);

async function start(playbackRate: number) {
  const spr1 = new OffscreenSprite(
    new MP4Clip((await fetch(resList[0])).body!),
  );
  spr1.time.playbackRate = playbackRate;

  const spr2 = new OffscreenSprite(
    new ImgClip(
      await renderTxt2ImgBitmap(
        '水印',
        `font-size:40px; color: white; text-shadow: 2px 2px 6px red;`,
      ),
    ),
  );
  spr2.time = { offset: 0, duration: 5e6 };
  spr2.setAnimation(
    {
      '0%': { x: 0, y: 0 },
      '25%': { x: 1200, y: 680 },
      '50%': { x: 1200, y: 0 },
      '75%': { x: 0, y: 680 },
      '100%': { x: 0, y: 0 },
    },
    { duration: 4e6, iterCount: 1 },
  );
  spr2.zIndex = 10;
  spr2.opacity = 0.5;

  const com = new Combinator({
    width: 1280,
    height: 720,
    bgColor: 'white',
  });

  await com.addSprite(spr1, { main: true });
  await com.addSprite(spr2);
  return com;
}

export default function UI() {
  const [com, setCom] = useState<null | Combinator>(null);
  const [playbackRate, setPlaybackRate] = useState(1);
  return (
    <>
      <div className="flex gap-4 items-center">
        <div>Playback rate:</div>
        <div className="flex-1">
          <Slider
            min={0}
            max={3}
            step={0.1}
            value={playbackRate}
            onChange={setPlaybackRate}
          ></Slider>
        </div>
      </div>
      <CombinatorPlay
        list={resList}
        onStart={async () => setCom(await start(playbackRate))}
        com={com}
      ></CombinatorPlay>
    </>
  );
}
