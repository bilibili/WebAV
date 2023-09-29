import './mock'
import { beforeEach, expect, test, vi } from 'vitest'
import { AVCanvas } from '../av-canvas'
import { createEl } from '../utils'
import { VideoSprite } from '../sprites/video-sprite'
import { crtMSEvt4Offset, cvsCaptureStreamMock, CvsElementMock } from './mock'

function createAVCanvas(): {
  avCvs: AVCanvas
  container: HTMLElement
} {
  const container = createEl('div')
  return {
    avCvs: new AVCanvas(container, {
      resolution: { width: 100, height: 100 },
      bgColor: '#333'
    }),
    container
  }
}

let { avCvs, container } = createAVCanvas()

beforeEach(() => {
  container.remove()

  // cvsRatio = { w: 1, h: 1 }
  CvsElementMock.clientHeight.mockImplementation(() => 100)
  CvsElementMock.clientWidth.mockImplementation(() => 100)

  const d = createAVCanvas()
  avCvs = d.avCvs
  container = d.container
})

test('av-canvas create & destroy', () => {
  const spyMngDestroy = vi.spyOn(avCvs.spriteManager, 'destroy')
  avCvs.destroy()
  expect(spyMngDestroy).toBeCalled()
})

test('init center the Sprite', async () => {
  const vs = new VideoSprite('vs', new MediaStream())
  await vs.initReady
  vs.rect.w = 80
  vs.rect.h = 80
  await avCvs.spriteManager.addSprite(vs)
  expect(vs.rect.x).toBe((100 - 80) / 2)
  expect(vs.rect.y).toBe((100 - 80) / 2)
})

test('captureStream', () => {
  const mockMS = new MediaStream()
  cvsCaptureStreamMock.mockReturnValueOnce(mockMS)
  vi.spyOn(mockMS, 'getTracks').mockReturnValue(['mock-track'] as any)

  const ms = avCvs.captureStream()
  expect(ms).toBeInstanceOf(MediaStream)
  expect(ms.addTrack).toBeCalledWith('mock-track')
})

test('activeSprite', async () => {
  const vs = new VideoSprite('vs', new MediaStream())
  await vs.initReady
  vs.rect.w = 80
  vs.rect.h = 80
  await avCvs.spriteManager.addSprite(vs)

  const cvsEl = container.querySelector('canvas') as HTMLCanvasElement
  cvsEl.dispatchEvent(crtMSEvt4Offset('mousedown', 20, 20))
  expect(avCvs.spriteManager.activeSprite).toBe(vs)

  cvsEl.dispatchEvent(crtMSEvt4Offset('mousedown', 10, 10))
  // 命中 ctrls.lt
  expect(avCvs.spriteManager.activeSprite).toBe(vs)

  cvsEl.dispatchEvent(crtMSEvt4Offset('mousedown', 0, 0))
  expect(avCvs.spriteManager.activeSprite).toBeNull()
})

test('dynamicCusor', async () => {
  const vs = new VideoSprite('vs', new MediaStream())
  await vs.initReady
  vs.rect.w = 80
  vs.rect.h = 80
  await avCvs.spriteManager.addSprite(vs)
  const cvsEl = container.querySelector('canvas') as HTMLCanvasElement
  cvsEl.dispatchEvent(crtMSEvt4Offset('mousedown', 20, 20))
  window.dispatchEvent(crtMSEvt4Offset('mouseup', 20, 20))

  expect(avCvs.spriteManager.activeSprite).toBe(vs)
  expect(cvsEl.style.cursor).toBe('move')

  const { center, ctrls: { lt, rotate } } = vs.rect
  cvsEl.dispatchEvent(crtMSEvt4Offset(
    'mousemove',
    lt.x + center.x,
    lt.y + center.y
  ))
  expect(cvsEl.style.cursor).toBe('nwse-resize')

  cvsEl.dispatchEvent(crtMSEvt4Offset(
    'mousemove',
    rotate.x + center.x,
    rotate.y + center.y
  ))
  expect(cvsEl.style.cursor).toBe('crosshair')

  cvsEl.dispatchEvent(crtMSEvt4Offset('mousemove', 0, 0))
  expect(cvsEl.style.cursor).toBe('')

  cvsEl.dispatchEvent(crtMSEvt4Offset('mousemove', 20, 20))
  expect(cvsEl.style.cursor).toBe('move')
})
