import { test, expect } from 'vitest'
import './mock'
import { concatFloat32Array, mixPCM } from '../av-utils'

test('concatArrayBuffer', () => {
  expect(
    concatFloat32Array([new Float32Array([1]), new Float32Array([2])])
  ).toEqual(new Float32Array([1, 2]))
})

test('mixPCM', () => {
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
