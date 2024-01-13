import '../../__tests__/mock'
import { beforeAll, describe, expect, test, vi } from 'vitest'
import mp4box from '@webav/mp4box.js'
import { file2stream } from '..'

beforeAll(() => {
  vi.useFakeTimers()
})

describe('file2stream', () => {
  test('enqueue data to stream', () => {
    const file = mp4box.createFile()
    file.boxes = []

    const { stop, stream } = file2stream(file, 500)
    expect(stream).toBeInstanceOf(ReadableStream)
    expect(stop).toBeInstanceOf(Function)

    vi.advanceTimersByTime(500)
    expect(stream._ctrl.enqueue).not.toBeCalled()

    file.boxes.push(
      ...Array(5)
        .fill(0)
        .map(() => ({ write: vi.fn(), data: new ArrayBuffer(0) }))
    )

    vi.advanceTimersByTime(500)
    expect(stream._ctrl.enqueue).toHaveBeenCalledWith(new Uint8Array())
    // 内存引用被清理
    expect([...file.boxes]).toEqual(Array(5).fill(undefined))
  })

  test('stop stream', () => {
    const file = mp4box.createFile()
    file.boxes = Array(5)
      .fill(0)
      .map(() => ({ write: vi.fn(), data: new ArrayBuffer(0) }))
    vi.spyOn(file, 'flush')
    vi.spyOn(global, 'clearInterval')

    const { stop, stream } = file2stream(file, 500)
    stop()

    expect(file.flush).toBeCalled()
    expect(stream._ctrl.enqueue).toBeCalled()
    expect(stream._ctrl.close).toBeCalled()
    expect(vi.getTimerCount()).toBe(1)
    expect(global.clearInterval).toBeCalled()
  })

  test('cancel stream', () => {
    const file = mp4box.createFile()
    file.boxes = Array(5)
      .fill(0)
      .map(() => ({ write: vi.fn(), data: new ArrayBuffer(0) }))
    vi.spyOn(file, 'flush')
    vi.spyOn(global, 'clearInterval')

    const spyCancel = vi.fn()
    const { stream } = file2stream(file, 500, spyCancel)
    stream.cancel()

    expect(global.clearInterval).toBeCalled()
    expect(spyCancel).toBeCalled()
  })
})
