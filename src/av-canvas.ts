import { SpriteManager } from './sprites/sprite-manager'
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

  captureStream (): MediaStream {
    const ms = new MediaStream()
    this.#cvsEl.captureStream().getTracks().concat(
      this.spriteManager.audioMSDest.stream.getTracks()
    ).forEach((t) => {
      ms.addTrack(t)
    })
    return ms
  }

  #render (): void {
    const cvsCtx = this.#cvsCtx
    const list = this.spriteManager.getSprites()
    list.forEach(r => r.render(cvsCtx))

    // todo: 使用dom替代canvas绘制控制点
    // 绘制 ctrls
    const actSpr = this.spriteManager.activeSprite
    if (actSpr == null) return
    cvsCtx.fillStyle = '#ffffff'
    const { center, ctrls, angle } = actSpr.rect
    cvsCtx.setTransform(
      // 水平 缩放、倾斜
      1, 0,
      // 垂直 倾斜、缩放
      0, 1,
      // 坐标原点偏移 x y
      center.x, center.y
    )
    cvsCtx.rotate(angle)
    Object.values(ctrls).forEach(({ x, y, w, h }) => {
      cvsCtx.fillRect(x, y, w, h)
    })
    cvsCtx.resetTransform()
  }
}
