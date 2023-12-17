import { getBoundingClientRectMock } from '../../__tests__/mock'
import { vi, test, expect, beforeEach, afterEach } from 'vitest'
import { TextSprite } from '../text-sprite'

beforeEach(() => {
  getBoundingClientRectMock.mockImplementation(() => {
    return {
      width: 100,
      height: 100
    } as unknown as DOMRect
  })
})

afterEach(() => {
  getBoundingClientRectMock.mockRestore()
})

test('font-sprite', () => {
  const textSpr = new TextSprite('text', '示例文本')
  const mockCtx = {
    drawImage: vi.fn(),
    rotate: vi.fn(),
    setTransform: vi.fn()
  }
  textSpr.render(mockCtx as unknown as CanvasRenderingContext2D)
  expect(mockCtx.drawImage).toBeCalledWith(
    expect.any(HTMLImageElement),
    -50, -50, 100, 100
  )
  expect(mockCtx.rotate).toBeCalledTimes(1)
  expect(mockCtx.setTransform).toBeCalledTimes(1)
})
