import { beforeEach, describe, expect, test } from 'vitest'
import { AudioBufferMock } from './mock'
import { AudioClip } from '../clips'

describe('AudioClip', () => {
  beforeEach(() => {
    AudioBufferMock.duration = 10
    // duration 10s
    AudioBufferMock.getChannelData.mockReturnValue(new Float32Array(48000 * 10))
  })

  test('audio clip decode', async () => {
    const clip = new AudioClip(new ArrayBuffer(0))
    await clip.ready
    expect(clip.meta.duration).toBe(10 * 1e6)
  })

  test('audio clip tick', async () => {
    const clip = new AudioClip(new ArrayBuffer(0))
    await clip.ready
    expect(await clip.tick(0)).toEqual({
      audio: [new Float32Array(0), new Float32Array(0)],
      state: 'success'
    })
    // 每次取 30ms 的数据
    await clip.tick(1000 * 30 * 1)
    const {
      audio: [chan0, chan1],
      state
    } = await clip.tick(1000 * 30 * 2)
    expect(state).toBe('success')
    expect(chan0.length).toBe((48000 / 1e3) * 30)
    expect(chan1.length).toBe((48000 / 1e3) * 30)
  })
})
