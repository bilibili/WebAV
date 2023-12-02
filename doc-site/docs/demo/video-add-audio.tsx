import {
  AudioClip,
  Combinator,
  MP4Clip,
  OffscreenSprite,
} from '@webav/av-cliper';
import React, { useState } from 'react';
import { CombinatorPlay } from './combinator-player';

const resList = ['/video/webav1.mp4', '/audio/44.1kHz-2chan.mp3'];

async function start() {
  const videoSpr = new OffscreenSprite(
    'videoSpr',
    new MP4Clip((await fetch(resList[0])).body!),
  );

  const audioSpr = new OffscreenSprite(
    'audioSpr',
    new AudioClip((await fetch(resList[1])).body!, {
      loop: true,
    }),
  );
  const com = new Combinator({
    width: 1280,
    height: 720,
  });
  await com.add(videoSpr, { duration: 10, main: true });
  await com.add(audioSpr);
  return com;
}

export default function UI() {
  const [com, setCom] = useState<null | Combinator>(null);
  async function onStart() {
    const com = await start();
    setCom(com);
  }
  return (
    <CombinatorPlay list={resList} onStart={onStart} com={com}></CombinatorPlay>
  );
}
