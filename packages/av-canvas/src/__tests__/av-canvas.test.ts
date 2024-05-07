import { beforeEach, expect, test } from 'vitest';
import { AVCanvas } from '../av-canvas';
import { createEl } from '../utils';
import { crtMSEvt4Offset } from './mock';
import { IClip, VisibleSprite } from '@webav/av-cliper';

function createAVCanvas(): {
  avCvs: AVCanvas;
  container: HTMLElement;
} {
  const container = createEl('div');
  return {
    avCvs: new AVCanvas(container, {
      width: 100,
      height: 100,
      bgColor: '#333',
    }),
    container,
  };
}

let { avCvs, container } = createAVCanvas();

class MockClip implements IClip {
  tick = async () => {
    return { audio: [], state: 'success' as const };
  };
  ready = Promise.resolve({ width: 0, height: 0, duration: 0 });
  clone = async () => {
    return new MockClip() as this;
  };
  destroy = () => {};
}

beforeEach(() => {
  container.remove();

  const d = createAVCanvas();
  avCvs = d.avCvs;
  container = d.container;
});

test('init center the Sprite', async () => {
  const vs = new VisibleSprite(new MockClip());
  await vs.ready;
  vs.rect.w = 80;
  vs.rect.h = 80;
  await avCvs.addSprite(vs);
  expect(vs.rect.x).toBe((100 - 80) / 2);
  expect(vs.rect.y).toBe((100 - 80) / 2);
});

test('captureStream', () => {
  const ms = avCvs.captureStream();
  expect(ms).toBeInstanceOf(MediaStream);
});

test('dynamicCusor', async () => {
  const vs = new VisibleSprite(new MockClip());
  await avCvs.addSprite(vs);
  vs.rect.w = 80;
  vs.rect.h = 80;
  const cvsEl = container.querySelector('canvas') as HTMLCanvasElement;
  cvsEl.dispatchEvent(crtMSEvt4Offset('mousedown', 20, 20));
  window.dispatchEvent(crtMSEvt4Offset('mouseup', 20, 20));

  expect(cvsEl.style.cursor).toBe('move');

  const {
    center,
    ctrls: { lt, rotate },
  } = vs.rect;
  cvsEl.dispatchEvent(
    crtMSEvt4Offset('mousemove', lt.x + center.x, lt.y + center.y),
  );
  expect(cvsEl.style.cursor).toBe('nwse-resize');

  cvsEl.dispatchEvent(
    crtMSEvt4Offset('mousemove', rotate.x + center.x, rotate.y + center.y),
  );
  expect(cvsEl.style.cursor).toBe('crosshair');

  cvsEl.dispatchEvent(crtMSEvt4Offset('mousemove', 0, 0));
  expect(cvsEl.style.cursor).toBe('');

  cvsEl.dispatchEvent(crtMSEvt4Offset('mousemove', 20, 20));
  expect(cvsEl.style.cursor).toBe('move');
});
