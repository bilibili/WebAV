import { test, expect } from 'vitest';
import { OffscreenSprite } from '../offscreen-sprite';
import { AudioClip, MP4Clip } from '../clips';
import { Combinator } from '../combinator';

const m4a_44kHz_2chan = `//${location.host}/audio/44.1kHz-2chan.m4a`;
const mp3_16kHz_1chan = `//${location.host}/audio/16kHz-1chan.mp3`;

test('Combinator ouput m4a', async () => {
  const resp1 = await fetch(m4a_44kHz_2chan);
  const resp2 = await fetch(mp3_16kHz_1chan);
  const spr1 = new OffscreenSprite('videoSpr', new AudioClip(resp1.body!));
  const spr2 = new OffscreenSprite('audioSpr', new AudioClip(resp2.body!));

  const com = new Combinator({});
  await com.add(spr1, { offset: 0, duration: 5 });
  await com.add(spr2, { offset: 0, duration: 4 });

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
