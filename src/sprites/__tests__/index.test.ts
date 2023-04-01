import { describe, expect, test, vi } from 'vitest'
import { Rect, SpriteManager, VideoSprite } from '..'

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

describe('Sprite', () => {
  test('checkHit sprite', () => {
    const vs = new VideoSprite('vs', new MediaStream())
    vs.rect = new Rect()
    vs.rect.x = 100
    vs.rect.y = 100
    vs.rect.w = 100
    vs.rect.h = 100
    // 边界检查
    expect(vs.checkHit(99, 99)).toBe(false)
    expect(vs.checkHit(100, 100)).toBe(true)
    expect(vs.checkHit(200, 200)).toBe(true)
    expect(vs.checkHit(201, 201)).toBe(false)

    expect(vs.checkHit(150, 90)).toBe(false)
    vs.rect.angle = Math.PI / 4
    // 原位置（左上角顶点）不在 pos（正方形）旋转 45° 之后的范围内
    expect(vs.checkHit(100, 100)).toBe(false)
    // 旋转后正上方外移一点点的位置被覆盖进来了
    expect(vs.checkHit(150, 90)).toBe(true)
  })
})

describe('Rect', () => {
  test('center', () => {
    const rect = new Rect(0, 0, 100, 100)
    expect(rect.center).toEqual({ x: 50, y: 50 })
  })

  test('ctrls', () => {
    const rect = new Rect(0, 0, 100, 100)
    expect(rect.ctrls).toMatchSnapshot()
  })

  test('clone', () => {
    const { x, y, w, h } = new Rect(0, 0, 100, 100).clone()
    expect([x, y, w, h]).toEqual([0, 0, 100, 100])
  })
})
