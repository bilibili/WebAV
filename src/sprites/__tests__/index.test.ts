import { describe, expect, test, vi } from 'vitest'
import { SpriteManager, VideoSprite } from '..'

test('1 + 1', () => {
  expect(1 + 1).toBe(2)
})

Object.assign(global, { MediaStream: vi.fn() })

describe('Sprite Manager', () => {
  const sprMng = new SpriteManager()
  test('addSprite', () => {
    const vs1 = new VideoSprite('vs1', new MediaStream())
    vs1.zIndex = 10
    const vs2 = new VideoSprite('vs2', new MediaStream())
    vs1.zIndex = 1

    sprMng.addSprite(vs1)
    sprMng.addSprite(vs2)

    expect(sprMng.getSprites().map(it => it.name))
      .toEqual(['vs2', 'vs1'])
  })
})
