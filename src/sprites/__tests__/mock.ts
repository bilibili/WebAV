import { vi } from 'vitest'

Object.assign(global, {
  MediaStream: vi.fn().mockImplementation(() => {
    return {
      getAudioTracks: () => []
    }
  })
})

Object.assign(global, {
  AudioContext: vi.fn().mockImplementation(() => {
    return {
      createMediaStreamDestination: vi.fn()
    }
  })
})

vi.spyOn(HTMLVideoElement.prototype, 'addEventListener')
  .mockImplementation((_, handler: any) => {
    handler()
  })

vi.spyOn(HTMLVideoElement.prototype, 'play')
  .mockImplementation(async () => {
    return await Promise.resolve()
  })
