import { describe, expect, test } from 'vitest';
import { TAnimationKeyFrame, linearTimeFn } from '../base-sprite';

describe('Animation', () => {
  const keyFrames: TAnimationKeyFrame = [
    [0, { angle: 0, x: 0, opacity: 1 }],
    [0.2, { angle: Math.PI / 2, x: 50, opacity: 0.5 }],
    [1, { angle: Math.PI, x: 100, opacity: 0 }],
  ];
  const opts = {
    duration: 10,
    delay: 0,
    iterCount: Infinity,
  };

  test('linearTimeFn 10%', () => {
    const rs = linearTimeFn(1, keyFrames, opts);
    expect(rs).toEqual({ angle: Math.PI / 4, x: 25, opacity: 0.75 });
  });

  test('linearTimeFn 20%', () => {
    const rs = linearTimeFn(2, keyFrames, opts);
    expect(rs).toEqual({ angle: Math.PI / 2, x: 50, opacity: 0.5 });
  });

  test('linearTimeFn 100%', () => {
    const rs = linearTimeFn(10, keyFrames, opts);
    expect(rs).toEqual({ angle: Math.PI, x: 100, opacity: 0 });
  });
});
