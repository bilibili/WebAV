import { describe, expect, test } from 'vitest'
import { AudioBufferMock } from './mock'
import { AudioClip } from '../clips'

describe('AudioClip', () => {
  test('decode audio', async () => {
    AudioBufferMock.duration = 10
    // duration 10s
    AudioBufferMock.getChannelData.mockReturnValue(new ArrayBuffer(48000 * 10))
    const clip = new AudioClip(new ArrayBuffer(0))
    await clip.ready
    expect(await clip.tick(0)).toEqual({
      audio: [],
      state: 'next'
    })
    // 30ms
    const {
      audio: [chan0, chan1],
      state
    } = await clip.tick(1000 * 30)
    expect('state').toBe('success')
    expect(chan0.length).toBe((48000 / 1e3) * 30)
  })
})
