import { vi, expect, test } from 'vitest';
import { SpriteManager } from '../sprite-manager';
import { MockVisibleSprite } from '../../__tests__/test-utils';

test('addSprite', async () => {
  const sprMng = new SpriteManager();

  const vs1 = new MockVisibleSprite();
  vs1.zIndex = 10;
  const vs2 = new MockVisibleSprite();
  vs1.zIndex = 1;

  await sprMng.addSprite(vs1);
  await sprMng.addSprite(vs2);

  expect(sprMng.getSprites()).toEqual([vs2, vs1]);
});

test('removeSprite', async () => {
  const sprMng = new SpriteManager();

  const vs1 = new MockVisibleSprite();
  await sprMng.addSprite(vs1);

  const spyDestroy = vi.spyOn(vs1, 'destroy');
  sprMng.removeSprite(vs1);
  expect(spyDestroy).toBeCalled();
});

test('spriteManager destroy', async () => {
  const sprMng = new SpriteManager();

  const vs1 = new MockVisibleSprite();
  const spyDestroy = vi.spyOn(vs1, 'destroy');
  await sprMng.addSprite(vs1);

  sprMng.destroy();
  expect(spyDestroy).toBeCalled();
});
