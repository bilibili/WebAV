import { IPoint } from '../types'
import { mediaStream2Video } from '../utils'

export class Rect {
  x = 0
  y = 0
  w = 0
  h = 0
  angle = 0

  get center (): IPoint {
    const { x, y, w, h } = this
    return { x: x + w / 2, y: y + h / 2 }
  }
}

export abstract class BaseSprite {
  rect = new Rect()

  visible = true

  zIndex = 0

  constructor (public name: string) {}

  abstract render (ctx: CanvasRenderingContext2D): void

  abstract destory (ctx: CanvasRenderingContext2D): void

  /**
   * 检测点击是否命中
   */
  checkHit (tx: number, ty: number): boolean {
    let { angle, center, x, y, w, h } = this.rect
    // 鼠标点击坐标映射成 canvas坐标, 然后转换为以中点为原点的坐标
    const tOX = tx - center.x
    const tOY = ty - center.y
    x = x - center.x
    y = y - center.y
    // 如果有旋转，映射成相对 sprite 原点，旋转前的坐标
    let mx = tOX
    let my = tOY
    if (angle !== 0) {
    // 推导公式 https://github.com/hughfenghen/hughfenghen.github.io/issues/96
      mx = tOX * Math.cos(angle) + tOY * Math.sin(angle)
      my = tOY * Math.cos(angle) - tOX * Math.sin(angle)
    }

    if (mx < x || mx > x + w || my < y || my > y + h) return false

    return true
  }
}

export class VideoSprite extends BaseSprite {
  #videoEl: HTMLVideoElement | null = null

  constructor (name: string, source: MediaStream) {
    super(name)
    this.init(source).catch(console.error)
  }

  async init (ms: MediaStream): Promise<void> {
    this.#videoEl = await mediaStream2Video(ms)
    this.rect.w = this.#videoEl.videoWidth
    this.rect.h = this.#videoEl.videoHeight
  }

  render (ctx: CanvasRenderingContext2D): void {
    if (this.#videoEl == null) return
    // todo: rect and clip
    const { x, y, w, h } = this.rect
    ctx.drawImage(this.#videoEl, x, y, w, h)
  }

  destory (): void {
    this.#videoEl?.remove()
    this.#videoEl = null
  }
}

export class SpriteManager {
  #sprites: BaseSprite[] = []

  addSprite<R extends BaseSprite>(res: R): void {
    this.#sprites.push(res)
    this.#sprites = this.#sprites.sort((a, b) => a.zIndex - b.zIndex)
    // todo: 动态适配宽高
  }

  getSprites (): BaseSprite[] {
    return this.#sprites
  }
}
