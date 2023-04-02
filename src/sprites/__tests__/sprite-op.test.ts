import { beforeEach, describe, expect, test, vi } from 'vitest'
import { SpriteManager, VideoSprite } from '..'
import { createEl } from '../../utils'
import { draggabelSprite } from '../sprite-op'

Object.assign(global, { MediaStream: vi.fn() })

/**
 * Mock 鼠标事件，初始化 offsetXY 值
 * @param evtName
 * @param offsetX
 * @param offsetY
 * @returns
 */
function crtMSEvt4Offset (evtName: string, offsetX: number, offsetY: number): MouseEvent {
  const evt = new MouseEvent(evtName)
  vi.spyOn(evt, 'offsetX', 'get').mockImplementation(() => offsetX)
  vi.spyOn(evt, 'offsetY', 'get').mockImplementation(() => offsetY)
  return evt
}

let cvsEl = createEl('canvas') as HTMLCanvasElement
const cvsRatio = {
  w: 1,
  h: 1
}
let sprMng = new SpriteManager()
beforeEach(() => {
  sprMng = new SpriteManager()
  cvsEl = createEl('canvas') as HTMLCanvasElement
  vi.spyOn(cvsEl, 'clientWidth', 'get').mockImplementation(() => 900)
  vi.spyOn(cvsEl, 'clientHeight', 'get').mockImplementation(() => 500)
  cvsEl.width = 1920
  cvsEl.height = 1080
  cvsRatio.w = 900 / 1920
  cvsRatio.h = 500 / 1080
})

describe('draggabelSprite', () => {
  test('canvas on mousedown', () => {
    const spyAEL = vi.spyOn(cvsEl, 'addEventListener')
    const spyREL = vi.spyOn(cvsEl, 'removeEventListener')

    const clear = draggabelSprite(cvsEl, sprMng)
    expect(spyAEL).toBeCalledWith('mousedown', expect.any(Function))
    expect(clear).toBeInstanceOf(Function)

    clear()
    expect(spyREL).toBeCalledWith('mousedown', expect.any(Function))
  })

  test('window on mouse event', () => {
    const spyAEL = vi.spyOn(window, 'addEventListener')
    const spyREL = vi.spyOn(window, 'removeEventListener')
    const vs = new VideoSprite('vs', new MediaStream())
    vi.spyOn(vs.rect, 'checkHit').mockReturnValue(true)
    sprMng.addSprite(vs)
    const clear = draggabelSprite(cvsEl, sprMng)
    cvsEl.dispatchEvent(new MouseEvent('mousedown'))

    expect(spyAEL).toBeCalledTimes(2)
    expect(spyAEL).toHaveBeenNthCalledWith(1, 'mousemove', expect.any(Function))
    expect(spyAEL).toHaveBeenNthCalledWith(2, 'mouseup', expect.any(Function))

    clear()
    expect(spyREL).toHaveBeenNthCalledWith(1, 'mousemove', expect.any(Function))
    expect(spyREL).toHaveBeenNthCalledWith(2, 'mouseup', expect.any(Function))
  })

  test('sprite check hit', () => {
    const vs = new VideoSprite('vs', new MediaStream())
    vi.spyOn(vs.rect, 'checkHit')

    sprMng.addSprite(vs)
    const clear = draggabelSprite(cvsEl, sprMng)
    cvsEl.dispatchEvent(crtMSEvt4Offset('mousedown', 100, 100))
    // 点击事件是页面坐标，需要按比例映射成 canvas 内部坐标
    expect(vs.rect.checkHit).toBeCalledWith(100 / cvsRatio.w, 100 / cvsRatio.h)

    clear()
  })

  test('move sprite', () => {
    const vs = new VideoSprite('vs', new MediaStream())
    vs.rect.w = 100
    vs.rect.h = 100

    sprMng.addSprite(vs)
    const clear = draggabelSprite(cvsEl, sprMng)
    cvsEl.dispatchEvent(crtMSEvt4Offset('mousedown', 0, 0))
    window.dispatchEvent(new MouseEvent('mousemove', {
      clientX: 100,
      clientY: 100
    }))
    expect(vs.rect.x).toBe(100 / cvsRatio.w)
    expect(vs.rect.y).toBe(100 / cvsRatio.h)

    // 鼠标移动超出边界
    window.dispatchEvent(new MouseEvent('mousemove', {
      clientX: 10000,
      clientY: 10000
    }))
    // sprite 至少保留10px在可视区域内
    expect(vs.rect.x).toBe(cvsEl.width - 10)
    expect(vs.rect.y).toBe(cvsEl.height - 10)

    clear()
  })
})

describe('stretchScale sprite', () => {
  test('drag right ctrl', () => {
    const vs = new VideoSprite('vs', new MediaStream())
    vs.rect.w = 100
    vs.rect.h = 100
    sprMng.addSprite(vs)

    // 激活 sprite
    const clear = draggabelSprite(cvsEl, sprMng)
    cvsEl.dispatchEvent(crtMSEvt4Offset('mousedown', 0, 0))
    expect(sprMng.activeSprite).toBe(vs)

    window.dispatchEvent(new MouseEvent('mouseup'))
    // 命中 right ctrl
    cvsEl.dispatchEvent(crtMSEvt4Offset(
      'mousedown',
      100 * cvsRatio.w,
      50 * cvsRatio.h
    ))
    window.dispatchEvent(new MouseEvent('mousemove', {
      clientX: 100,
      clientY: 100
    }))
    // 拖拽 right ctrl 缩放 rect 的宽度
    expect(vs.rect.w).toBe(100 + 100 / cvsRatio.w)

    clear()
  })
})
