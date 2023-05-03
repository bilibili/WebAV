import { describe, expect, test } from 'vitest'
import { Rect, TAnimationKeyFrame, linearTimeFn } from '../rect'

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

  test('checkHit', () => {
    const rect = new Rect(100, 100, 100, 100)
    rect.x = 100
    rect.y = 100
    rect.w = 100
    rect.h = 100
    // 边界检查
    expect(rect.checkHit(99, 99)).toBe(false)
    expect(rect.checkHit(100, 100)).toBe(true)
    expect(rect.checkHit(200, 200)).toBe(true)
    expect(rect.checkHit(201, 201)).toBe(false)

    expect(rect.checkHit(150, 90)).toBe(false)
    rect.angle = Math.PI / 4
    // 原位置（左上角顶点）不在 pos（正方形）旋转 45° 之后的范围内
    expect(rect.checkHit(100, 100)).toBe(false)
    // 旋转后正上方外移一点点的位置被覆盖进来了
    expect(rect.checkHit(150, 90)).toBe(true)
  })
})

describe('Animation', () => {
  const keyFrames: TAnimationKeyFrame = [
    [0, { angle: 0, x: 0 }],
    [0.2, { angle: Math.PI / 2, x: 50 }],
    [1, { angle: Math.PI, x: 100 }]
  ]
  const opts = {
    duration: 10,
    delay: 0,
    iterationCount: Infinity
  }

  test('linearTimeFn 10%', () => {
    const rs = linearTimeFn(1, keyFrames, opts)
    expect(rs).toEqual({ angle: Math.PI / 4, x: 25 })
  })

  test('linearTimeFn 20%', () => {
    const rs = linearTimeFn(2, keyFrames, opts)
    expect(rs).toEqual({ angle: Math.PI / 2, x: 50 })
  })

  test('linearTimeFn 100%', () => {
    const rs = linearTimeFn(10, keyFrames, opts)
    expect(rs).toEqual({ angle: Math.PI, x: 100 })
  })
})
