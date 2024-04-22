import { expect, test } from 'vitest';
import { AudioClip, DEFAULT_AUDIO_CONF, concatAudioClip } from '..';

// duration: 122s
const m4a_44kHz_2chan = `//${location.host}/audio/44.1kHz-2chan.m4a`;
// duration: 4s
const mp3_16kHz_1chan = `//${location.host}/audio/16kHz-1chan.mp3`;

test('AudioClip tick', async () => {
  const clip = new AudioClip((await fetch(m4a_44kHz_2chan)).body!);
  await clip.ready;
  expect(await clip.tick(0)).toEqual({
    audio: [new Float32Array(0), new Float32Array(0)],
    state: 'success',
  });
  // 每次取 30ms 的数据
  await clip.tick(1000 * 30 * 1);
  const {
    audio: [chan0, chan1],
    state: s1,
  } = await clip.tick(1000 * 30 * 2);
  expect(s1).toBe('success');
  expect(chan0.length).toBe((DEFAULT_AUDIO_CONF.sampleRate / 1e3) * 30);
  expect(chan1.length).toBe((DEFAULT_AUDIO_CONF.sampleRate / 1e3) * 30);

  // 取第 130s 的数据，音频时长 122s
  const { state: s2 } = await clip.tick(130e6);
  expect(s2).toBe('done');
});

test('AudioClip volume', async () => {
  const clip1 = new AudioClip((await fetch(m4a_44kHz_2chan)).body!);
  const clip2 = new AudioClip((await fetch(m4a_44kHz_2chan)).body!, {
    volume: 0.1,
  });
  await clip1.ready;
  await clip2.ready;
  const {
    audio: [clip1Chan0],
  } = await clip1.tick(20e6);
  const {
    audio: [clip2Chan0],
  } = await clip2.tick(20e6);
  // 音量调整就是乘以 系数，小数位太多，只判断前 5 位
  expect(Math.round(clip1Chan0[950000] * 1e5 * 0.1)).toBe(
    Math.round(clip2Chan0[950000] * 1e5),
  );
});

test('AudioClip loop', async () => {
  const clip = new AudioClip((await fetch(m4a_44kHz_2chan)).body!, {
    loop: true,
  });
  await clip.ready;
  // 接近尾端
  await clip.tick(120e6);
  // 超过尾端 1s
  const {
    audio: [chan0],
  } = await clip.tick(130e6);
  // 超过音频长度，也能获取完整的 10s 数据
  expect(chan0.length).toBe(DEFAULT_AUDIO_CONF.sampleRate * 10);
});

test('concatAudioClip', async () => {
  const clip1 = new AudioClip((await fetch(m4a_44kHz_2chan)).body!);
  const clip2 = new AudioClip((await fetch(mp3_16kHz_1chan)).body!);

  // 两个clip 各10s，合成后总长度 20s
  const clip = await concatAudioClip([clip1, clip2]);
  const { audio, state: s1 } = await clip.tick(19 * 1e6);
  expect(s1).toBe('success');
  expect(audio.length).toBe(2);

  const { state: s2 } = await clip.tick(130e6);
  expect(s2).toBe('done');
});
