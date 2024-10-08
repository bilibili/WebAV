import { afterEach, beforeEach, describe, expect, test, vi } from 'vitest';
import { SpriteManager } from '../sprite-manager';
import { createEl } from '../../utils';
import { draggabelSprite } from '../sprite-op';
import { MockVisibleSprite, crtMSEvt4Offset } from '../../__tests__/test-utils';

const cvsRatio = { w: 1, h: 1 };
let sprMng = new SpriteManager();

let cvsEl: HTMLCanvasElement;
beforeEach(() => {
  sprMng = new SpriteManager();
  cvsEl = createEl('canvas') as HTMLCanvasElement;
  cvsEl.style.cssText = 'width: 1280px; height: 720px';
  cvsEl.width = 1280;
  cvsEl.height = 720;
  document.body.appendChild(cvsEl);
});
afterEach(() => {
  cvsEl.remove();
});

describe('draggabelSprite', () => {
  test('canvas on mousedown', () => {
    const spyAEL = vi.spyOn(cvsEl, 'addEventListener');
    const spyREL = vi.spyOn(cvsEl, 'removeEventListener');

    const clear = draggabelSprite(cvsEl, sprMng, document.body);
    expect(spyAEL).toBeCalledWith('mousedown', expect.any(Function));
    expect(clear).toBeInstanceOf(Function);

    clear();
    expect(spyREL).toBeCalledWith('mousedown', expect.any(Function));
  });

  test('window on mouse event', async () => {
    const spyAEL = vi.spyOn(window, 'addEventListener');
    const spyREL = vi.spyOn(window, 'removeEventListener');
    const vs = new MockVisibleSprite();
    vi.spyOn(vs.rect, 'checkHit').mockReturnValue(true);
    await sprMng.addSprite(vs);
    sprMng.activeSprite = vs;
    const clear = draggabelSprite(cvsEl, sprMng, document.body);
    cvsEl.dispatchEvent(new MouseEvent('mousedown'));

    expect(spyAEL).toBeCalledTimes(2);
    expect(spyAEL).toHaveBeenNthCalledWith(
      1,
      'mousemove',
      expect.any(Function),
    );
    expect(spyAEL).toHaveBeenNthCalledWith(2, 'mouseup', expect.any(Function));

    clear();
    expect(spyREL).toHaveBeenNthCalledWith(
      1,
      'mousemove',
      expect.any(Function),
    );
    expect(spyREL).toHaveBeenNthCalledWith(2, 'mouseup', expect.any(Function));
  });

  test('move sprite', async () => {
    const vs = new MockVisibleSprite();
    vs.rect.x = 100;
    vs.rect.y = 100;
    vs.rect.w = 100;
    vs.rect.h = 100;

    await sprMng.addSprite(vs);
    sprMng.activeSprite = vs;

    const clear = draggabelSprite(cvsEl, sprMng, document.body);
    cvsEl.dispatchEvent(crtMSEvt4Offset('mousedown', 110, 110));

    window.dispatchEvent(
      new MouseEvent('mousemove', {
        clientX: 100,
        clientY: 100,
      }),
    );
    expect(vs.rect.x).toBe(200);
    expect(vs.rect.y).toBe(200);

    // 鼠标移动超出边界
    window.dispatchEvent(
      new MouseEvent('mousemove', {
        clientX: 10000,
        clientY: 10000,
      }),
    );
    // 5% 安全边界
    expect(vs.rect.x).toBe(cvsEl.width - cvsEl.width * 0.05);
    expect(vs.rect.y).toBe(cvsEl.height - cvsEl.height * 0.05);

    clear();
  });
});

describe('scale sprite', () => {
  test('drag right ctrl', async () => {
    const vs = new MockVisibleSprite();
    await sprMng.addSprite(vs);
    sprMng.activeSprite = vs;
    vs.rect.w = 100;
    vs.rect.h = 100;

    // 激活 sprite
    const clear = draggabelSprite(cvsEl, sprMng, document.body);
    cvsEl.dispatchEvent(crtMSEvt4Offset('mousedown', 0, 0));
    expect(sprMng.activeSprite).toBe(vs);

    window.dispatchEvent(new MouseEvent('mouseup'));
    // 命中 right ctrl
    cvsEl.dispatchEvent(
      crtMSEvt4Offset('mousedown', 100 * cvsRatio.w, 50 * cvsRatio.h),
    );
    window.dispatchEvent(
      new MouseEvent('mousemove', {
        clientX: 100,
        clientY: 100,
      }),
    );
    // 拖拽 right ctrl 缩放 rect 的宽度
    expect(vs.rect.w).toBe(100 + 100 / cvsRatio.w);

    clear();
  });

  test('drag rb(bottom right) ctrl', async () => {
    const vs = new MockVisibleSprite();
    await sprMng.addSprite(vs);
    sprMng.activeSprite = vs;
    vs.rect.w = 100;
    vs.rect.h = 100;

    // 激活 sprite
    const clear = draggabelSprite(cvsEl, sprMng, document.body);
    cvsEl.dispatchEvent(crtMSEvt4Offset('mousedown', 0, 0));
    expect(sprMng.activeSprite).toBe(vs);

    window.dispatchEvent(new MouseEvent('mouseup'));
    // 命中 bottom right ctrl
    cvsEl.dispatchEvent(
      crtMSEvt4Offset('mousedown', 100 * cvsRatio.w, 100 * cvsRatio.h),
    );
    window.dispatchEvent(
      new MouseEvent('mousemove', {
        clientX: 100,
        clientY: 100,
      }),
    );
    expect(vs.rect).toMatchSnapshot();

    clear();
  });

  test('drag right ctrl below min size', async () => {
    const vs = new MockVisibleSprite();
    await sprMng.addSprite(vs);
    sprMng.activeSprite = vs;
    vs.rect.x = 100;
    vs.rect.y = 100;
    vs.rect.w = 100;
    vs.rect.h = 100;
    vs.rect.angle = 30 * (Math.PI / 180);
    // 激活 sprite
    const clear = draggabelSprite(cvsEl, sprMng, document.body);
    cvsEl.dispatchEvent(crtMSEvt4Offset('mousedown', 150, 150));
    expect(sprMng.activeSprite).toBe(vs);

    window.dispatchEvent(new MouseEvent('mouseup'));
    // 命中 right ctrl
    cvsEl.dispatchEvent(
      crtMSEvt4Offset(
        'mousedown',
        100 + 50 * cvsRatio.w + Math.cos(30 * (Math.PI / 180)) * 50,
        100 + 50 * cvsRatio.h + 25,
      ),
    );
    window.dispatchEvent(
      new MouseEvent('mousemove', {
        clientX: -100,
        clientY: -100,
      }),
    );
    // 拖拽 right ctrl 缩放 rect 的宽度
    expect(vs.rect.w).toBe(10);
    expect(Math.round(vs.rect.x)).toBe(106);
    expect(Math.round(vs.rect.y)).toBe(78);
    clear();
  });

  test('drag top ctrl below min size', async () => {
    const vs = new MockVisibleSprite();
    await sprMng.addSprite(vs);
    sprMng.activeSprite = vs;
    vs.rect.w = 100;
    vs.rect.h = 100;
    vs.rect.angle = 90 * (Math.PI / 180);
    // 激活 sprite
    const clear = draggabelSprite(cvsEl, sprMng, document.body);
    cvsEl.dispatchEvent(crtMSEvt4Offset('mousedown', 50, 50));
    expect(sprMng.activeSprite).toBe(vs);

    window.dispatchEvent(new MouseEvent('mouseup'));
    // 命中 top ctrl
    cvsEl.dispatchEvent(crtMSEvt4Offset('mousedown', 0, 50));
    window.dispatchEvent(
      new MouseEvent('mousemove', {
        clientX: 300,
        clientY: 0,
      }),
    );
    // 拖拽 top ctrl 缩放 rect 的高度
    expect(vs.rect.h).toBe(10);
    expect(Math.round(vs.rect.x)).toBe(45);
    expect(Math.round(vs.rect.y)).toBe(45);
    clear();
  });

  test('drag rb(bottom right) ctrl below min size', async () => {
    const vs = new MockVisibleSprite();
    await sprMng.addSprite(vs);
    sprMng.activeSprite = vs;
    vs.rect.x = 100;
    vs.rect.y = 100;
    vs.rect.w = 100;
    vs.rect.h = 100;
    vs.rect.angle = 90 * (Math.PI / 180);
    // 激活 sprite
    const clear = draggabelSprite(cvsEl, sprMng, document.body);
    cvsEl.dispatchEvent(crtMSEvt4Offset('mousedown', 150, 150));
    expect(sprMng.activeSprite).toBe(vs);

    window.dispatchEvent(new MouseEvent('mouseup'));
    // 命中 bottom right ctrl
    cvsEl.dispatchEvent(crtMSEvt4Offset('mousedown', 100, 200));
    window.dispatchEvent(
      new MouseEvent('mousemove', {
        clientX: 100,
        clientY: -100,
      }),
    );
    // 拖拽 bottom right ctrl 缩放 rect 的宽度和高度
    expect(vs.rect.w).toBe(10);
    expect(vs.rect.h).toBe(10);
    expect(Math.round(vs.rect.x)).toBe(190);
    expect(Math.round(vs.rect.y)).toBe(100);
    clear();
  });
});

describe('rotate sprite', () => {
  test('rotate sprite', async () => {
    const vs = new MockVisibleSprite();
    await sprMng.addSprite(vs);
    sprMng.activeSprite = vs;
    vs.rect.w = 100;
    vs.rect.h = 100;

    // 激活 sprite
    const clear = draggabelSprite(cvsEl, sprMng, document.body);
    cvsEl.dispatchEvent(crtMSEvt4Offset('mousedown', 0, 0));
    expect(sprMng.activeSprite).toBe(vs);

    window.dispatchEvent(new MouseEvent('mouseup'));
    // 命中 rotate ctrl
    const {
      center,
      ctrls: { rotate },
    } = vs.rect;
    cvsEl.dispatchEvent(
      crtMSEvt4Offset(
        'mousedown',
        (rotate.x + center.x) * cvsRatio.w,
        (rotate.y + center.y) * cvsRatio.h,
      ),
    );
    window.dispatchEvent(
      new MouseEvent('mousemove', {
        clientX: 100,
        clientY: 100,
      }),
    );
    expect(vs.rect.angle).toMatchSnapshot();

    window.dispatchEvent(
      new MouseEvent('mousemove', {
        clientX: 100,
        clientY: 200,
      }),
    );
    expect(vs.rect.angle).toMatchSnapshot();

    clear();
  });
});
