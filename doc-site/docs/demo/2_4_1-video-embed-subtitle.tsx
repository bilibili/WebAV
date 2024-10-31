import {
  MP4Clip,
  EmbedSubtitlesClip,
  Combinator,
  OffscreenSprite,
} from '@webav/av-cliper';
import { useState } from 'react';
import { CombinatorPlay } from './combinator-player';
import { assetsPrefix } from './utils';

const resList = assetsPrefix(['video/webav1.mp4', 'subtitles/test-sample.srt']);
async function start() {
  const videoSpr = new OffscreenSprite(
    new MP4Clip((await fetch(resList[0])).body!),
  );
  videoSpr.time = { duration: 10e6, offset: 0 };
  const srtSpr = new OffscreenSprite(
    new EmbedSubtitlesClip(await (await fetch(resList[1])).text(), {
      videoWidth: 1280,
      videoHeight: 720,
      fontSize: 44,
      fontFamily: 'Noto Sans SC',
      strokeStyle: '#000',
      lineWidth: 20,
      lineJoin: 'round',
      lineCap: 'round',
      textShadow: {
        offsetX: 2,
        offsetY: 2,
        blur: 4,
        color: 'rgba(0,0,0,0.25)',
      },
    }),
  );
  srtSpr.time = { duration: 10e6, offset: 0 };
  const com = new Combinator({ width: 1280, height: 720 });
  await com.addSprite(videoSpr);
  await com.addSprite(srtSpr);
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
