import { expect, test, vi } from 'vitest';
import { VisibleSprite } from '../visible-sprite';
import { AudioClip } from '../../clips';
import { sleep } from '../../av-utils';

function createSprite() {
  return new VisibleSprite(new AudioClip([new Float32Array()]));
}

test('zIndex change event', () => {
  const spr = createSprite();
  const handler = vi.fn();
  spr.on('propsChange', handler);

  spr.zIndex = 10;
  expect(handler).toBeCalledWith({ zIndex: 10 });
});

test('rect change event', async () => {
  const spr = createSprite();
  const handler = vi.fn();
  spr.on('propsChange', handler);

  spr.rect.x = 10;
  spr.rect.y = 10;
  expect(handler).toBeCalledWith({ rect: { x: 10 } });
  expect(handler).toBeCalledWith({ rect: { y: 10 } });
  expect(handler).toBeCalledTimes(2);
});

test('sprite playbackRate', async () => {
  const spr = createSprite();
  const clip = spr.getClip();
  const spyTick = vi.spyOn(clip, 'tick');
  spr.time.playbackRate = 2;
  const cvs = new OffscreenCanvas(100, 100);
  const ctx = cvs.getContext('2d')!;
  spr.render(ctx, 1e6);
  expect(spyTick).toBeCalledWith(2e6);

  await sleep(100);

  spr.time.playbackRate = 0.5;
  spr.render(ctx, 2e6);
  expect(spyTick).toHaveBeenLastCalledWith(1e6);
});
