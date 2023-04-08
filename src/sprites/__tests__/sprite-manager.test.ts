import { vi, expect, test } from 'vitest'
import './mock'
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

  const spyDestory = vi.spyOn(vs1, 'destory')
  sprMng.removeSprite(vs1)
  expect(spyDestory).toBeCalled()
})

test('spriteManager destory', async () => {
  const sprMng = new SpriteManager()

  const vs1 = new VideoSprite('vs1', new MediaStream())
  const spyDestory = vi.spyOn(vs1, 'destory')
  await sprMng.addSprite(vs1)

  sprMng.destroy()
  expect(spyDestory).toBeCalled()
  expect(sprMng.audioMSDest.disconnect).toBeCalled()
  expect(sprMng.audioCtx.close).toBeCalled()
})
