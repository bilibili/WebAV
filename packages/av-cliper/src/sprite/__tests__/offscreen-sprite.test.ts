import { expect, test } from 'vitest';
import { OffscreenSprite } from '../offscreen-sprite';
import { AudioClip } from '../../clips';

function createSprite() {
  return new OffscreenSprite(new AudioClip([new Float32Array()]));
}

test('sprite animate', () => {
  const spr = createSprite();
  spr.setAnimation(
    {
      '0%': { x: 0, y: 0 },
      '25%': { x: 1200, y: 680 },
      '50%': { x: 1200, y: 0 },
      '75%': { x: 0, y: 680 },
      '100%': { x: 0, y: 0 },
    },
    { duration: 4e6, delay: 3e6 },
  );
  spr.animate(3e6);
  expect(spr.rect.x).toBe(0);
  spr.animate(4e6);
  expect(spr.rect.x).toBe(1200);
  expect(spr.rect.y).toBe(680);
  spr.animate(5e6);
  expect(spr.rect.x).toBe(1200);
  expect(spr.rect.y).toBe(0);
  spr.animate(6e6);
  expect(spr.rect.y).toBe(680);
});
