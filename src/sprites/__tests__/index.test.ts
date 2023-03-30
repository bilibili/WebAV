import { describe, expect, test } from 'vitest'
import { SpriteManager, VideoSprite } from '..'

test('1 + 1', () => {
  expect(1 + 1).toBe(2)
  console.error(111222)
})

describe('Sprite Manager', () => {
  const resMng = new SpriteManager()
  test('addSprite', () => {
    const res1 = new VideoSprite('res1', new MediaStream())
    res1.zIndex = 10
    const res2 = new VideoSprite('res2', new MediaStream())
    res1.zIndex = 1

    resMng.addSprite(res1)
    resMng.addSprite(res2)

    expect(resMng.getSprites().map(it => it.name))
      .toEqual(['res2', 'res1'])
  })
})
