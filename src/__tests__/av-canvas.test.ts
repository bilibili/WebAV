import { expect, test, vi } from 'vitest'
import '../sprites/__tests__/mock'
import { AVCanvas } from '../av-canvas'
import { createEl } from '../utils'

test('av-canvas create & destory', () => {
  const container = createEl('dev')

  const avCvs = new AVCanvas(container, {
    resolution: { width: 100, height: 100 },
    bgColor: '#333'
  })

  const spyMngDestroy = vi.spyOn(avCvs.spriteManager, 'destroy')
  avCvs.destory()
  expect(spyMngDestroy).toBeCalled()
})
