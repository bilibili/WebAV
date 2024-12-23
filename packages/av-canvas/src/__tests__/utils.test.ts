import { Rect } from '@webav/av-cliper';
import { afterAll, beforeAll, expect, test } from 'vitest';
import { createCtrlsGetter } from '../utils';

let rectCtrlsGetter: ReturnType<typeof createCtrlsGetter>['rectCtrlsGetter'];
let ctrlGetterDestroy: () => void;
beforeAll(() => {
  const cvsEl = document.createElement('canvas');
  ({ rectCtrlsGetter, destroy: ctrlGetterDestroy } = createCtrlsGetter(cvsEl));
});

afterAll(() => {
  ctrlGetterDestroy();
});

test('ctrls', () => {
  const rect = new Rect(0, 0, 100, 100);

  const ctrls = rectCtrlsGetter(rect);
  expect(
    Object.fromEntries(
      Object.entries(ctrls).map(([key, ctrl]) => [key, stringifyRect(ctrl)]),
    ),
  ).toMatchSnapshot();
});

// 固定比例后，ctrls 将移除 t,b,l,r 控制点
test('fixedAspectRatio', () => {
  const rect = new Rect(0, 0, 100, 100);
  expect(Object.keys(rectCtrlsGetter(rect))).toEqual([
    't',
    'b',
    'l',
    'r',
    'lt',
    'lb',
    'rt',
    'rb',
    'rotate',
  ]);
  rect.fixedAspectRatio = true;
  expect(Object.keys(rectCtrlsGetter(rect))).toEqual([
    'lt',
    'lb',
    'rt',
    'rb',
    'rotate',
  ]);
});

function stringifyRect(rect: Rect) {
  return `{x: ${rect.x}, y: ${rect.y}, w: ${rect.w}, h: ${rect.h}}`;
}
