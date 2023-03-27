import { describe, expect, test } from 'vitest'
import { ResourceManager, VideoResource } from '..'

test('1 + 1', () => {
  expect(1 + 1).toBe(2)
  console.error(111222)
})

describe('Resource Manager', () => {
  const resMng = new ResourceManager()
  test('addResource', () => {
    const res1 = new VideoResource('res1')
    res1.zIndex = 10
    const res2 = new VideoResource('res2')
    res1.zIndex = 1

    resMng.addResource(res1)
    resMng.addResource(res2)

    expect(resMng.getResourceList().map(it => it.name))
      .toEqual(['res2', 'res1'])
  })
})