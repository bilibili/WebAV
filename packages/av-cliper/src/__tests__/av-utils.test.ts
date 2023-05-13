import { test, expect } from 'vitest'
import { concatFloat32Array } from '../av-utils'

test('concatArrayBuffer', () => {
  expect(
    concatFloat32Array([new Float32Array([1]), new Float32Array([2])])
  ).toEqual(new Float32Array([1, 2]))
})
