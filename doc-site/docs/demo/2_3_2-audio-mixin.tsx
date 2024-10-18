import { AudioClip, Combinator, OffscreenSprite } from '@webav/av-cliper';
import { useState } from 'react';
import { CombinatorPlay } from './combinator-player';
import { assetsPrefix } from './utils';

const resList = assetsPrefix([
  'audio/16kHz-1chan.mp3',
  'audio/44.1kHz-2chan.m4a',
]);
async function start() {
  const clips = await await Promise.all(
    resList.map(async (url) => new AudioClip((await fetch(url)).body!)),
  );
  const com = new Combinator();
  let offset = 0;
  for (const clip of clips) {
    const audioSpr = new OffscreenSprite(clip);
    await audioSpr.ready;
    audioSpr.time.offset = offset;
    offset += audioSpr.time.duration;
    await com.addSprite(audioSpr);
  }

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
