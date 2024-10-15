import { expect, test } from 'vitest';
import { Rect } from '../rect';

test('center', () => {
  const rect = new Rect(0, 0, 100, 100);
  expect(rect.center).toEqual({ x: 50, y: 50 });
});

test('clone', () => {
  const { x, y, w, h } = new Rect(0, 0, 100, 100).clone();
  expect([x, y, w, h]).toEqual([0, 0, 100, 100]);
  expect(new Rect(0, 0, 100, 100).clone()).toMatchSnapshot();
});

test('checkHit', () => {
  const rect = new Rect(100, 100, 100, 100);
  rect.x = 100;
  rect.y = 100;
  rect.w = 100;
  rect.h = 100;
  // 边界检查
  expect(rect.checkHit(99, 99)).toBe(false);
  expect(rect.checkHit(100, 100)).toBe(true);
  expect(rect.checkHit(200, 200)).toBe(true);
  expect(rect.checkHit(201, 201)).toBe(false);

  expect(rect.checkHit(150, 90)).toBe(false);
  rect.angle = Math.PI / 4;
  // 原位置（左上角顶点）不在 pos（正方形）旋转 45° 之后的范围内
  expect(rect.checkHit(100, 100)).toBe(false);
  // 旋转后正上方外移一点点的位置被覆盖进来了
  expect(rect.checkHit(150, 90)).toBe(true);
});
