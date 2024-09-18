import { test, expect } from 'vitest';
// import './mock';
import {
  changePCMPlaybackRate,
  concatFloat32Array,
  concatPCMFragments,
  mixinPCM,
} from '../av-utils';

test('concatArrayBuffer', () => {
  expect(
    concatFloat32Array([new Float32Array([1]), new Float32Array([2])]),
  ).toEqual(new Float32Array([1, 2]));
});

test('mixinPCM', () => {
  const wav1 = new Float32Array([1, 1, 1]);
  const wav2 = new Float32Array([2, 2, 2, 2, 2]);

  expect(mixinPCM([[wav2, wav2]])).toEqual(
    new Float32Array([2, 2, 2, 2, 2, 2, 2, 2, 2, 2]),
  );
  expect(
    mixinPCM([
      [wav1, wav1],
      [wav2, wav2],
    ]),
  ).toEqual(new Float32Array([3, 3, 3, 2, 2, 3, 3, 3, 2, 2]));
});

test('mixinPCM empty track', () => {
  expect(
    mixinPCM([
      [new Float32Array([2, 2, 2, 2, 2]), new Float32Array([0, 0, 0, 0, 0])],
      [],
    ]),
  ).toEqual(new Float32Array([2, 2, 2, 2, 2, 0, 0, 0, 0, 0]));
});

test('concatFragmentPCM', () => {
  const chan0 = new Float32Array([0, 0, 0]);
  const chan1 = new Float32Array([1, 1, 1]);
  expect(
    concatPCMFragments([
      // 立体声（双声道）PCM片段
      [chan0, chan1],
      [chan0, chan1],
    ]),
  ).toEqual([
    new Float32Array([...chan0, ...chan0]),
    new Float32Array([...chan1, ...chan1]),
  ]);
});

test('changePCMPlaybackRate', () => {
  const pcm = new Float32Array([1, 2, 3, 4, 5]);
  expect(changePCMPlaybackRate(pcm, 0.5)).toEqual(
    new Float32Array([1, 1.5, 2, 2.5, 3, 3.5, 4, 4.5, 5, 5]),
  );
  expect(changePCMPlaybackRate(pcm, 2)).toEqual(new Float32Array([1, 3]));
});
