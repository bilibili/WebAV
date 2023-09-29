import { beforeEach, describe, expect, test, vi } from 'vitest'
import { crtMSEvt4Offset } from '../../__tests__/mock'
import { SpriteManager } from '../sprite-manager'
import { createEl } from '../../utils'
import { draggabelSprite } from '../sprite-op'
import { VideoSprite } from '../video-sprite'

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

  test('window on mouse event', async () => {
    const spyAEL = vi.spyOn(window, 'addEventListener')
    const spyREL = vi.spyOn(window, 'removeEventListener')
    const vs = new VideoSprite('vs', new MediaStream())
    vi.spyOn(vs.rect, 'checkHit').mockReturnValue(true)
    await sprMng.addSprite(vs)
    sprMng.activeSprite = vs
    const clear = draggabelSprite(cvsEl, sprMng)
    cvsEl.dispatchEvent(new MouseEvent('mousedown'))

    expect(spyAEL).toBeCalledTimes(2)
    expect(spyAEL).toHaveBeenNthCalledWith(1, 'mousemove', expect.any(Function))
    expect(spyAEL).toHaveBeenNthCalledWith(2, 'mouseup', expect.any(Function))

    clear()
    expect(spyREL).toHaveBeenNthCalledWith(1, 'mousemove', expect.any(Function))
    expect(spyREL).toHaveBeenNthCalledWith(2, 'mouseup', expect.any(Function))
  })

  test('move sprite', async () => {
    const vs = new VideoSprite('vs', new MediaStream())
    vs.rect.w = 100
    vs.rect.h = 100

    await sprMng.addSprite(vs)
    sprMng.activeSprite = vs

    const clear = draggabelSprite(cvsEl, sprMng)
    cvsEl.dispatchEvent(crtMSEvt4Offset('mousedown', 50, 50))

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

describe('scale sprite', () => {
  test('drag right ctrl', async () => {
    const vs = new VideoSprite('vs', new MediaStream())
    await sprMng.addSprite(vs)
    sprMng.activeSprite = vs
    vs.rect.w = 100
    vs.rect.h = 100

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

  test('drag rb(bottom right) ctrl', async () => {
    const vs = new VideoSprite('vs', new MediaStream())
    await sprMng.addSprite(vs)
    sprMng.activeSprite = vs
    vs.rect.w = 100
    vs.rect.h = 100

    // 激活 sprite
    const clear = draggabelSprite(cvsEl, sprMng)
    cvsEl.dispatchEvent(crtMSEvt4Offset('mousedown', 0, 0))
    expect(sprMng.activeSprite).toBe(vs)

    window.dispatchEvent(new MouseEvent('mouseup'))
    // 命中 right ctrl
    cvsEl.dispatchEvent(crtMSEvt4Offset(
      'mousedown',
      100 * cvsRatio.w,
      100 * cvsRatio.h
    ))
    window.dispatchEvent(new MouseEvent('mousemove', {
      clientX: 100,
      clientY: 100
    }))
    expect(vs.rect).toMatchSnapshot()

    clear()
  })
})

describe('rotate sprite', () => {
  test('rotate sprite', async () => {
    const vs = new VideoSprite('vs', new MediaStream())
    await sprMng.addSprite(vs)
    sprMng.activeSprite = vs
    vs.rect.w = 100
    vs.rect.h = 100

    // 激活 sprite
    const clear = draggabelSprite(cvsEl, sprMng)
    cvsEl.dispatchEvent(crtMSEvt4Offset('mousedown', 0, 0))
    expect(sprMng.activeSprite).toBe(vs)

    window.dispatchEvent(new MouseEvent('mouseup'))
    // 命中 rotate ctrl
    const { center, ctrls: { rotate } } = vs.rect
    cvsEl.dispatchEvent(crtMSEvt4Offset(
      'mousedown',
      (rotate.x + center.x) * cvsRatio.w,
      (rotate.y + center.y) * cvsRatio.h
    ))
    window.dispatchEvent(new MouseEvent('mousemove', {
      clientX: 100,
      clientY: 100
    }))
    expect(vs.rect.angle).toMatchSnapshot()

    window.dispatchEvent(new MouseEvent('mousemove', {
      clientX: 100,
      clientY: 200
    }))
    expect(vs.rect.angle).toMatchSnapshot()

    clear()
  })
})
