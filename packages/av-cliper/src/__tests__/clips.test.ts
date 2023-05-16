import { beforeEach, describe, expect, test } from 'vitest'
import { AudioBufferMock } from './mock'
import { AudioClip, DEFAULT_AUDIO_SAMPLE_RATE } from '../clips'

describe('AudioClip', () => {
  beforeEach(() => {
    AudioBufferMock.duration = 10
    // duration 10s
    AudioBufferMock.getChannelData.mockReturnValue(
      new Float32Array(DEFAULT_AUDIO_SAMPLE_RATE * 10)
    )
  })

  test('AudioClip decode', async () => {
    const clip = new AudioClip(new ArrayBuffer(0))
    await clip.ready
    expect(clip.meta.duration).toBe(10 * 1e6)
  })

  test('AudioClip tick', async () => {
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
      state: s1
    } = await clip.tick(1000 * 30 * 2)
    expect(s1).toBe('success')
    expect(chan0.length).toBe((DEFAULT_AUDIO_SAMPLE_RATE / 1e3) * 30)
    expect(chan1.length).toBe((DEFAULT_AUDIO_SAMPLE_RATE / 1e3) * 30)

    // 取第 11s 的数据
    const { state: s2 } = await clip.tick(1e6 * 11)
    expect(s2).toBe('done')
  })

  test('AudioClip volume', async () => {
    AudioBufferMock.getChannelData.mockReturnValueOnce(
      new Float32Array(Array(DEFAULT_AUDIO_SAMPLE_RATE * 10).fill(1))
    )
    const clip = new AudioClip(new ArrayBuffer(0), { volume: 0.1 })
    await clip.ready
    const {
      audio: [chan0]
    } = await clip.tick(1000 * 30)
    expect(Math.round(chan0[0] * 10) / 10).toBe(0.1)
  })

  test('AudioClip loop', async () => {
    const clip = new AudioClip(new ArrayBuffer(0), { loop: true })
    await clip.ready
    // 接近尾端
    await clip.tick(1e6 * 9)
    // 超过尾端 1s
    const {
      audio: [chan0]
    } = await clip.tick(1e6 * 11)
    expect(chan0.length).toBe(DEFAULT_AUDIO_SAMPLE_RATE * 2)
  })
})
