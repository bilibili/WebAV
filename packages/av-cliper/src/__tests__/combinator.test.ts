import { test, expect, vi } from 'vitest';
import { OffscreenSprite } from '../sprite/offscreen-sprite';
import { AudioClip, IClip, ImgClip, MP4Clip } from '../clips';
import { Combinator } from '../combinator';

const m4a_44kHz_2chan = `//${location.host}/audio/44.1kHz-2chan.m4a`;
const mp3_16kHz_1chan = `//${location.host}/audio/16kHz-1chan.mp3`;
const png_bunny = `//${location.host}/img/bunny.png`;

test('Combinator ouput m4a', async () => {
  const resp1 = await fetch(m4a_44kHz_2chan);
  const resp2 = await fetch(mp3_16kHz_1chan);
  const spr1 = new OffscreenSprite(new AudioClip(resp1.body!));
  const spr2 = new OffscreenSprite(new AudioClip(resp2.body!));

  const com = new Combinator();
  spr1.time = { offset: 0, duration: 1e6 };
  spr2.time = { offset: 0, duration: 1e6 };
  await com.addSprite(spr1);
  await com.addSprite(spr2);

  const mp4Clip = new MP4Clip(com.output());
  await mp4Clip.ready;
  expect(mp4Clip.meta).toEqual({
    duration: 1088000,
    width: 0,
    height: 0,
    audioSampleRate: 48000,
    audioChanCount: 2,
  });
});

test('Combinator.output throw an error', async () => {
  const spr = new OffscreenSprite(
    new (class MockClip implements IClip {
      tick = async () => {
        throw Error('xxx');
      };
      meta = { width: 0, height: 0, duration: 0 };
      ready = Promise.resolve(this.meta);
      clone = async () => new MockClip() as this;
      destroy = () => {};
      split = async (_: number) =>
        [new MockClip(), new MockClip()] as [this, this];
    })(),
  );
  const com = new Combinator();
  await com.addSprite(spr);

  const errHdlr = vi.fn();
  com.on('error', errHdlr);

  const reader = com.output().getReader();
  expect(async () => {
    try {
      await reader.read();
    } finally {
      expect(errHdlr).toBeCalledWith(Error('xxx'));
    }
  }).rejects.toThrowError('xxx');
});

test('Combinator ouput exclude audio track', async () => {
  const resp1 = await fetch(png_bunny);
  const spr1 = new OffscreenSprite(new ImgClip(resp1.body!));

  const com = new Combinator({ width: 900, height: 500, audio: false });
  spr1.time = { offset: 0, duration: 1e6 };
  await com.addSprite(spr1);

  const mp4Clip = new MP4Clip(com.output());
  await mp4Clip.ready;
  expect(mp4Clip.meta).toEqual({
    duration: 1023000,
    width: 900,
    height: 500,
    audioSampleRate: 0,
    audioChanCount: 0,
  });
});
