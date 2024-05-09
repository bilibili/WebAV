import { AudioClip, VisibleSprite } from '@webav/av-cliper';
import { vi } from 'vitest';

/**
 * Mock 鼠标事件，初始化 offsetXY 值
 * @param evtName
 * @param offsetX
 * @param offsetY
 * @returns
 */
export function crtMSEvt4Offset(
  evtName: string,
  offsetX: number,
  offsetY: number,
): MouseEvent {
  const evt = new MouseEvent(evtName);
  vi.spyOn(evt, 'offsetX', 'get').mockImplementation(() => offsetX);
  vi.spyOn(evt, 'offsetY', 'get').mockImplementation(() => offsetY);
  return evt;
}

export class MockVisibleSprite extends VisibleSprite {
  constructor() {
    super(new AudioClip([new Float32Array()]));
  }
}
