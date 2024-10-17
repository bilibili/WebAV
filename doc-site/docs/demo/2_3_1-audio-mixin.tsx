import { AudioClip, Combinator, OffscreenSprite } from '@webav/av-cliper';
import React, { useState } from 'react';
import { CombinatorPlay } from './combinator-player';
import { assetsPrefix } from './utils';

const resList = assetsPrefix([
  'audio/44.1kHz-2chan.m4a',
  'audio/16kHz-1chan.mp3',
]);
async function start() {
  const audioSpr1 = new OffscreenSprite(
    new AudioClip((await fetch(resList[0])).body!, { volume: 0.5 }),
  );
  audioSpr1.time = { offset: 0, duration: 5e6 };
  const audioSpr2 = new OffscreenSprite(
    new AudioClip((await fetch(resList[1])).body!),
  );
  audioSpr2.time = { offset: 0, duration: 4e6 };

  const com = new Combinator();
  await com.addSprite(audioSpr1);
  await com.addSprite(audioSpr2);
  return com;
}

export default function UI() {
  const [com, setCom] = useState<null | Combinator>(null);
  return (
    <CombinatorPlay
      list={resList}
      onStart={async () => setCom(await start())}
      com={com}
      mediaType="audio"
    ></CombinatorPlay>
  );
}
