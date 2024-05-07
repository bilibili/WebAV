import { test, expect } from 'vitest';
import { OffscreenSprite } from '../sprite/offscreen-sprite';
import { AudioClip, MP4Clip } from '../clips';
import { Combinator } from '../combinator';

const m4a_44kHz_2chan = `//${location.host}/audio/44.1kHz-2chan.m4a`;
const mp3_16kHz_1chan = `//${location.host}/audio/16kHz-1chan.mp3`;

test('Combinator ouput m4a', async () => {
  const resp1 = await fetch(m4a_44kHz_2chan);
  const resp2 = await fetch(mp3_16kHz_1chan);
  const spr1 = new OffscreenSprite(new AudioClip(resp1.body!));
  const spr2 = new OffscreenSprite(new AudioClip(resp2.body!));

  const com = new Combinator();
  spr1.time = { offset: 0, duration: 5e6 };
  spr2.time = { offset: 0, duration: 4e6 };
  await com.addSprite(spr1);
  await com.addSprite(spr2);

  const mp4Clip = new MP4Clip(com.output());
  await mp4Clip.ready;
  expect(mp4Clip.meta).toEqual({
    duration: 5098666,
    width: 0,
    height: 0,
    audioSampleRate: 48000,
    audioChanCount: 2,
  });
});
