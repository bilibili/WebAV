import { describe, expect, test, vi } from 'vitest'
import { VideoSprite } from '..'
import { createEl } from '../../utils'
import { draggabelSprite } from '../sprite-op'

Object.assign(global, { MediaStream: vi.fn() })

describe('draggabelSprite', () => {
  test('canvas on mousedown', () => {
    const cvsEl = createEl('canvas') as HTMLCanvasElement
    const spyAEL = vi.spyOn(cvsEl, 'addEventListener')
    const spyREL = vi.spyOn(cvsEl, 'removeEventListener')

    const clear = draggabelSprite(cvsEl, [])
    expect(spyAEL).toBeCalledWith('mousedown', expect.any(Function))
    expect(clear).toBeInstanceOf(Function)

    clear()
    expect(spyREL).toBeCalledWith('mousedown', expect.any(Function))
  })

  test('window on mouse event', () => {
    const cvsEl = createEl('canvas') as HTMLCanvasElement
    const spyAEL = vi.spyOn(window, 'addEventListener')
    const spyREL = vi.spyOn(window, 'removeEventListener')
    const clear = draggabelSprite(cvsEl, [])
    cvsEl.dispatchEvent(new MouseEvent('mousedown'))

    expect(spyAEL).toBeCalledTimes(2)
    expect(spyAEL).toHaveBeenNthCalledWith(1, 'mousemove', expect.any(Function))
    expect(spyAEL).toHaveBeenNthCalledWith(2, 'mouseup', expect.any(Function))

    clear()
    expect(spyREL).toHaveBeenNthCalledWith(1, 'mousemove', expect.any(Function))
    expect(spyREL).toHaveBeenNthCalledWith(2, 'mouseup', expect.any(Function))
  })

  test('sprite check hit', () => {
    const cvsEl = createEl('canvas') as HTMLCanvasElement
    vi.spyOn(cvsEl, 'clientWidth', 'get').mockImplementation(() => 900)
    vi.spyOn(cvsEl, 'clientHeight', 'get').mockImplementation(() => 500)
    cvsEl.width = 1920
    cvsEl.height = 1080

    const vs = new VideoSprite('vs', new MediaStream())
    vi.spyOn(vs, 'checkHit')

    const clear = draggabelSprite(cvsEl, [vs])
    const evt = new MouseEvent('mousedown')
    vi.spyOn(evt, 'offsetX', 'get').mockImplementation(() => 100)
    vi.spyOn(evt, 'offsetY', 'get').mockImplementation(() => 100)
    cvsEl.dispatchEvent(evt)
    // 点击事件是页面坐标，需要按比例映射成 canvas 内部坐标
    expect(vs.checkHit).toBeCalledWith(100 / (900 / 1920), 100 / (500 / 1080))

    clear()
  })
})
