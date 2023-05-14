import { vi, expect, test } from 'vitest'
import { mixPCM } from '../mp4-utils'
import './mock'

test('mixPCM2AudioData', () => {
  const wav1 = new Float32Array([1, 1, 1])
  const wav2 = new Float32Array([2, 2, 2, 2, 2])

  expect(mixPCM([[], [wav2, wav2]])).toEqual(
    new Float32Array([2, 2, 2, 2, 2, 2, 2, 2, 2, 2])
  )
  expect(
    mixPCM([
      [wav1, wav1],
      [wav2, wav2]
    ])
  ).toEqual(new Float32Array([3, 3, 3, 2, 2, 3, 3, 3, 2, 2]))
})
