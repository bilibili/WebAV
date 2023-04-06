import { vi } from 'vitest'

export const MediaStreamMock = {
  getAudioTracks: vi.fn().mockReturnValue([]),
  removeTrack: vi.fn(),
  addTrack: vi.fn()
}

Object.assign(global, {
  MediaStream: vi.fn().mockImplementation(() => {
    return Object.assign(
      Object.create(MediaStream.prototype),
      MediaStreamMock
    )
  })
})

export const AudioContextMock = {
  createGain: vi.fn().mockImplementation(() => {
    return { gain: vi.fn() }
  }),
  createMediaStreamSource: vi.fn().mockImplementation(() => {
    return { connect: vi.fn() }
  }),
  createMediaStreamDestination: vi.fn()
}

Object.assign(global, {
  AudioContext: vi.fn().mockImplementation(() => {
    return Object.assign(
      Object.create(AudioContext.prototype),
      AudioContextMock
    )
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

export const getBoundingClientRectMock = vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect')

URL.createObjectURL = vi.fn()
URL.revokeObjectURL = vi.fn()
