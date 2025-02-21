import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { AVCanvas } from '../av-canvas';
import { createCtrlsGetter, createEl } from '../utils';
import { crtMSEvt4Offset } from './test-utils';
import { IClip, VisibleSprite } from '@webav/av-cliper';

let container: HTMLDivElement;
let avCvs: AVCanvas;
let rectCtrlsGetter: ReturnType<typeof createCtrlsGetter>['rectCtrlsGetter'];
let ctrlGetterDestroy: () => void;
beforeEach(() => {
  container = createEl('div') as HTMLDivElement;
  container.style.cssText = `
    width: 1280px;
    height: 720px;
  `;
  document.body.appendChild(container);
  avCvs = new AVCanvas(container, {
    width: 1280,
    height: 720,
    bgColor: '#333',
  });
  const cvsEl = container.querySelector('canvas') as HTMLCanvasElement;
  ({ rectCtrlsGetter, destroy: ctrlGetterDestroy } = createCtrlsGetter(cvsEl));
});

afterEach(() => {
  ctrlGetterDestroy();
  container.remove();
  avCvs.destroy();
});

class MockClip implements IClip {
  tick = async () => {
    return { audio: [], state: 'success' as const };
  };
  meta = { width: 0, height: 0, duration: 0 };
  ready = Promise.resolve(this.meta);
  clone = async () => {
    return new MockClip() as this;
  };
  destroy = () => {};
  split = async (_: number) => [new MockClip(), new MockClip()] as [this, this];
}

test('captureStream', () => {
  const ms = avCvs.captureStream();
  expect(ms).toBeInstanceOf(MediaStream);
});

test('dynamicCusor', async () => {
  const vs = new VisibleSprite(new MockClip());
  vs.rect.x = 100;
  vs.rect.y = 100;
  vs.rect.w = 100;
  vs.rect.h = 100;
  await avCvs.addSprite(vs);
  const cvsEl = container.querySelector('canvas') as HTMLCanvasElement;
  cvsEl.dispatchEvent(crtMSEvt4Offset('pointerdown', 110, 110));
  window.dispatchEvent(crtMSEvt4Offset('pointerup', 110, 110));

  expect(cvsEl.style.cursor).toBe('move');

  const { center } = vs.rect;
  const { lt, rotate } = rectCtrlsGetter(vs.rect);
  cvsEl.dispatchEvent(
    crtMSEvt4Offset('pointermove', lt.x + center.x, lt.y + center.y),
  );
  expect(cvsEl.style.cursor).toBe('nwse-resize');

  cvsEl.dispatchEvent(
    crtMSEvt4Offset(
      'pointermove',
      rotate.x + center.x + 1,
      rotate.y + center.y + 1,
    ),
  );
  expect(cvsEl.style.cursor).toBe('crosshair');

  cvsEl.dispatchEvent(crtMSEvt4Offset('pointermove', 0, 0));
  expect(cvsEl.style.cursor).toBe('');

  cvsEl.dispatchEvent(crtMSEvt4Offset('pointermove', 110, 110));
  expect(cvsEl.style.cursor).toBe('move');
});

test('AVCanvas events', async () => {
  const onPaused = vi.fn();
  const onPlaying = vi.fn();
  avCvs.on('paused', onPaused);
  avCvs.on('playing', onPlaying);

  avCvs.play({ start: 0, end: 10e6 });
  expect(onPlaying).toBeCalledTimes(1);
  avCvs.pause();
  expect(onPaused).toBeCalledTimes(1);
  avCvs.play({ start: 0, end: 10e6 });
  expect(onPlaying).toBeCalledTimes(2);
  avCvs.previewFrame(5e6);
  expect(onPaused).toBeCalledTimes(2);
});
