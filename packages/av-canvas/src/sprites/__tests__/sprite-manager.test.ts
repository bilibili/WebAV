import { vi, expect, test } from 'vitest'
import '../../__tests__/mock'
import { SpriteManager } from '../sprite-manager'
import { VideoSprite } from '../video-sprite'

test('addSprite', async () => {
  const sprMng = new SpriteManager()

  const vs1 = new VideoSprite('vs1', new MediaStream())
  vs1.zIndex = 10
  const vs2 = new VideoSprite('vs2', new MediaStream())
  vs1.zIndex = 1

  await sprMng.addSprite(vs1)
  await sprMng.addSprite(vs2)

  expect(sprMng.getSprites().map(it => it.name))
    .toEqual(['vs2', 'vs1'])
})

test('removeSprite', async () => {
  const sprMng = new SpriteManager()

  const vs1 = new VideoSprite('vs1', new MediaStream())
  await sprMng.addSprite(vs1)

  const spyDestroy = vi.spyOn(vs1, 'destroy')
  sprMng.removeSprite(vs1)
  expect(spyDestroy).toBeCalled()
})

test('spriteManager destroy', async () => {
  const sprMng = new SpriteManager()

  const vs1 = new VideoSprite('vs1', new MediaStream())
  const spyDestroy = vi.spyOn(vs1, 'destroy')
  await sprMng.addSprite(vs1)

  sprMng.destroy()
  expect(spyDestroy).toBeCalled()
  expect(sprMng.audioMSDest.disconnect).toBeCalled()
  expect(sprMng.audioCtx.close).toBeCalled()
})
