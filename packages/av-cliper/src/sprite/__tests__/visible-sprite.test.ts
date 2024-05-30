import { expect, test, vi } from 'vitest';
import { VisibleSprite } from '../visible-sprite';
import { AudioClip } from '../../clips';

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
