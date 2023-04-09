import { vi, test, expect, beforeAll, afterAll } from 'vitest'
import { VideoSprite } from '../video-sprite'
import { createObjectURLMock, MediaStreamMock, revokeObjectURLMock } from './mock'

beforeAll(() => {
  MediaStreamMock.getAudioTracks.mockReturnValue([vi.fn()])
})

afterAll(() => {
  MediaStreamMock.getAudioTracks.mockRestore()
})

test('VideoSprite render', async () => {
  const vs = new VideoSprite('vs', new MediaStream())
  await vs.initReady
  vs.rect.w = 100
  vs.rect.h = 100
  const mockCtx = {
    drawImage: vi.fn(),
    rotate: vi.fn(),
    setTransform: vi.fn()
  }
  vs.render(mockCtx as unknown as CanvasRenderingContext2D)

  expect(mockCtx.drawImage).toBeCalledWith(
    expect.any(HTMLVideoElement),
    -50, -50, 100, 100
  )
  expect(mockCtx.rotate).toBeCalledWith(0)
  expect(mockCtx.setTransform).toBeCalledWith(1, 0, 0, 1, 50, 50)
})

test('VideoSprite destroy', async () => {
  const vs = new VideoSprite('vs', new MediaStream())
  await vs.initReady
  const spyRM = vi.spyOn(HTMLVideoElement.prototype, 'remove')
  vs.destroy()
  expect(spyRM).toBeCalledTimes(1)
})

test('VideoSprite default volume', async () => {
  const vs = new VideoSprite('vs', new MediaStream())
  await vs.initReady
  expect(vs.volume).toBe(0)
  vs.volume = 1
  expect(vs.volume).toBe(0)
})

test('VideoSprite audio ctrl', async () => {
  const ms = new MediaStream()
  const vs = new VideoSprite('vs', ms, {
    audioCtx: new AudioContext()
  })
  await vs.initReady
  expect(vs.audioNode).not.toBeNull()
  expect(vs.volume).toBe(0)
  vs.volume = 1
  expect(vs.volume).toBe(1)
})

test('create VideoSprite with file', async () => {
  createObjectURLMock.mockReturnValueOnce('mock-video-src')
  const vs = new VideoSprite(
    'vs-file',
    { type: 'video/mp4' } as unknown as File,
    { audioCtx: new AudioContext() }
  )
  await vs.initReady

  expect(createObjectURLMock).toBeCalledTimes(1)
  vs.destroy()
  expect(vs.audioNode?.disconnect).toBeCalledTimes(1)
  expect(revokeObjectURLMock).toBeCalledWith(
    expect.stringMatching(/mock-video-src$/)
  )
})
