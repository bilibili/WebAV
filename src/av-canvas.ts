import { SpriteManager } from './sprites'
import { draggabelSprite } from './sprites/sprite-op'
import { IResolution } from './types'
import { createEl } from './utils'

function createInitCvsEl (resolution: IResolution): HTMLCanvasElement {
  const cvsEl = createEl('canvas') as HTMLCanvasElement
  cvsEl.style.cssText = `
    width: 100%;
    height: 100%;
  `
  cvsEl.width = resolution.width
  cvsEl.height = resolution.height
  // todo: 关闭 Alpha 通道

  return cvsEl
}

export class AVCanvas {
  #container: HTMLElement
  #cvsEl: HTMLCanvasElement

  spriteManager: SpriteManager

  #cvsCtx: CanvasRenderingContext2D

  #destroyed = false

  #clears: Array<() => void> = []

  constructor (container: HTMLElement, opts: {
    resolution: IResolution
    bgColor: string
  }) {
    this.#container = container
    this.#cvsEl = createInitCvsEl(opts.resolution)
    const ctx = this.#cvsEl.getContext('2d')
    if (ctx == null) throw Error('canvas context is null')
    this.#cvsCtx = ctx
    container.appendChild(this.#cvsEl)

    this.spriteManager = new SpriteManager()

    // todo: add sprite 场景
    this.#clears.push(
      draggabelSprite(
        this.#cvsEl,
        this.spriteManager
      )
    )

    const loop = (): void => {
      if (this.#destroyed) return

      this.#cvsCtx.fillStyle = opts.bgColor
      this.#cvsCtx.fillRect(0, 0, opts.resolution.width, opts.resolution.height)
      this.#render()
      requestAnimationFrame(loop)
    }
    loop()
  }

  destory (): void {
    this.#destroyed = true
    this.#cvsEl.remove()
    this.#clears.forEach(fn => fn())
  }

  #render (): void {
    const list = this.spriteManager.getSprites()
    list.forEach(r => r.render(this.#cvsCtx))
    // console.log(22222, list)
  }
}
