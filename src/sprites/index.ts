import { mediaStream2Video } from '../utils'
import { Rect } from './rect'

export abstract class BaseSprite {
  rect = new Rect()

  visible = true

  zIndex = 0

  constructor (public name: string) {}

  render (ctx: CanvasRenderingContext2D): void {
    const { rect: { center, ctrls } } = this
    // 绘制 ctrls
    ctx.transform(1, 0, 0, 1, center.x, center.y)
    ctx.fillStyle = '#ffffff'
    Object.values(ctrls).forEach(({ x, y, w, h }) => {
      ctx.fillRect(x, y, w, h)
    })
    ctx.resetTransform()
  }

  abstract destory (ctx: CanvasRenderingContext2D): void
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
    // todo: 使用dom替代canvas绘制控制点
    super.render(ctx)
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
