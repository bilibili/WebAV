import { test, expect, vi } from 'vitest';
import { OffscreenSprite } from '../sprite/offscreen-sprite';
import { AudioClip, IClip, ImgClip, MP4Clip } from '../clips';
import { Combinator, createAudioTrackBuf } from '../combinator';
import { extractPCM4AudioData } from '../av-utils';

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

test('audio track buffer', () => {
  const framsCnt = 10;
  const audioBuf = createAudioTrackBuf(framsCnt);
  const data = [
    new Float32Array([0, 0, 0, 0, 0, 0]), // chan0
    new Float32Array([1, 1, 1, 1, 1, 1]), // chan1
  ];

  let ts = 0;
  const duration = (data[0].length / 48000) * 1e6;
  let ads = audioBuf(ts, [data, data]);
  ts += duration;
  expect(ads.length).toBe(0);

  ads = audioBuf(ts, [data, data]);
  ts += duration;
  expect(ads.length).toBe(1);
  expect(ads[0].format).toBe('f32');
  expect(ads[0].timestamp).toBe(0);

  ads = audioBuf(ts, [data, data]);
  ts += duration;
  ads = audioBuf(ts, [data, data]);
  ts += duration;
  expect(ads.length).toBe(1);
  expect(ads[0].format).toBe('f32');
  expect(~~ads[0].timestamp).toBe(208);

  const [chan0, chan1] = extractPCM4AudioData(ads[0]);
  expect(chan0.length).toBe(framsCnt);
  // 每次 两个 data chan1 的元素值都为 1， 混音之后 值为 2
  expect(chan1).toEqual(new Float32Array(Array(framsCnt).fill(2)));
});

test('audio track buffer IO data', () => {
  const framsCnt = 1024;
  const audioBuf = createAudioTrackBuf(framsCnt);
  // 大概 17ms 音频帧数
  const unitSize = ~~(0.017 * 48000);
  const inputSize = unitSize * 20;
  const outputSize = inputSize - (inputSize % framsCnt);
  const inputData = new Float32Array(inputSize);
  const outputData = new Float32Array(outputSize);
  let outOffset = 0;
  let ts = 0;
  const duration = (unitSize / 48000) * 1e6;
  for (let i = 0; i < 20; i++) {
    const data = [
      new Float32Array(Array(unitSize).fill(i)), // chan0
      new Float32Array(Array(unitSize).fill(i)), // chan1
    ];
    inputData.set(data[0], i * unitSize);
    let ads = audioBuf(ts, [data, data]);
    ts += duration;
    if (ads.length === 0) continue;

    expect(ads[0].format).toBe('f32');
    const [chan0, chan1] = extractPCM4AudioData(ads[0]);
    expect(chan0).toEqual(chan1);
    expect(chan0.length).toBe(framsCnt);
    outputData.set(chan0, outOffset);
    outOffset += chan0.length;
  }
  expect(outOffset).toBe(outputSize);
  expect(outputData).toEqual(
    // 两个音轨 混音（相加）之后值需要乘以 2
    inputData.subarray(0, outputSize).map((v) => v * 2),
  );
});

test('placeholder audiodata', () => {
  const framsCnt = 1024;
  const audioBuf = createAudioTrackBuf(framsCnt);
  // 大概 17ms 音频帧数
  const unitSize = ~~(0.017 * 48000);
  const inputSize = unitSize * 20;
  const outputSize = inputSize - (inputSize % framsCnt);
  const outputData = new Float32Array(outputSize);
  let outOffset = 0;
  let ts = 0;
  const duration = (unitSize / 48000) * 1e6;
  for (let i = 0; i < 20; i++) {
    const ads = audioBuf(ts, []);
    ts += duration;
    if (ads.length === 0) continue;
    const [chan0] = extractPCM4AudioData(ads[0]);
    outputData.set(chan0, outOffset);
  }
  expect(outputData.length).toBe(outputSize);
  // 没有输入任何数据，使用空数据（0）占位
  expect(outputData).toEqual(new Float32Array(outputSize));
});
