import { beforeEach, expect, test } from 'vitest';
// import { AudioBufferMock } from '../../__tests__/mock';
import { AudioClip, DEFAULT_AUDIO_CONF, concatAudioClip } from '..';

// beforeEach(() => {
//   AudioBufferMock.duration = 10;
//   // duration 10s
//   AudioBufferMock.getChannelData.mockReturnValue(
//     new Float32Array(DEFAULT_AUDIO_CONF.sampleRate * 10),
//   );
// });

test('AudioClip tick', async () => {
  const clip = new AudioClip(new ReadableStream());
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

  // 取第 11s 的数据
  const { state: s2 } = await clip.tick(1e6 * 11);
  expect(s2).toBe('done');
});

test('AudioClip volume', async () => {
  // AudioBufferMock.getChannelData.mockReturnValueOnce(
  //   new Float32Array(Array(DEFAULT_AUDIO_CONF.sampleRate * 10).fill(1)),
  // );
  const clip = new AudioClip(new ReadableStream(), { volume: 0.1 });
  await clip.ready;
  const {
    audio: [chan0],
  } = await clip.tick(1000 * 30);
  expect(Math.round(chan0[0] * 10) / 10).toBe(0.1);
});

test('AudioClip loop', async () => {
  const clip = new AudioClip(new ReadableStream(), { loop: true });
  await clip.ready;
  // 接近尾端
  await clip.tick(1e6 * 9);
  // 超过尾端 1s
  const {
    audio: [chan0],
  } = await clip.tick(1e6 * 11);
  expect(chan0.length).toBe(DEFAULT_AUDIO_CONF.sampleRate * 2);
});

test('concatAudioClip', async () => {
  const clip1 = new AudioClip(new ReadableStream());
  const clip2 = new AudioClip(new ReadableStream());

  // 两个clip 各10s，合成后总长度 20s
  const clip = await concatAudioClip([clip1, clip2]);
  const { audio, state: s1 } = await clip.tick(19 * 1e6);
  expect(s1).toBe('success');
  expect(audio.length).toBe(2);

  const { state: s2 } = await clip.tick(21 * 1e6);
  expect(s2).toBe('done');
});
