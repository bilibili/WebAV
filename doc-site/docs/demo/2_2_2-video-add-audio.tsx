import {
  AudioClip,
  Combinator,
  ImgClip,
  OffscreenSprite,
} from '@webav/av-cliper';
import React, { useState } from 'react';
import { CombinatorPlay } from './combinator-player';
import { assetsPrefix } from './utils';

const resList = assetsPrefix(['img/animated.gif', 'audio/44.1kHz-2chan.m4a']);

async function start() {
  const gifSpr = new OffscreenSprite(
    new ImgClip({ type: 'image/gif', stream: (await fetch(resList[0])).body! }),
  );
  gifSpr.time = { duration: 10e6, offset: 0 };
  const audioSpr = new OffscreenSprite(
    new AudioClip((await fetch(resList[1])).body!),
  );
  audioSpr.time = { duration: 10e6, offset: 0 };
  const com = new Combinator({ width: 1280, height: 720 });
  await com.addSprite(gifSpr);
  await com.addSprite(audioSpr);
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
