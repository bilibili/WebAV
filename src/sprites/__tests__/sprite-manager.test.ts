import { describe, expect, test } from 'vitest'
import './mock'
import { SpriteManager } from '../sprite-manager'
import { VideoSprite } from '../video-sprite'

test('1 + 1', () => {
  expect(1 + 1).toBe(2)
})

describe('Sprite Manager', () => {
  const sprMng = new SpriteManager()
  test('addSprite', async () => {
    const vs1 = new VideoSprite('vs1', new MediaStream())
    vs1.zIndex = 10
    const vs2 = new VideoSprite('vs2', new MediaStream())
    vs1.zIndex = 1

    await sprMng.addSprite(vs1)
    await sprMng.addSprite(vs2)

    expect(sprMng.getSprites().map(it => it.name))
      .toEqual(['vs2', 'vs1'])
  })
})
