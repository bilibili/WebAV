import { mediaStream2Video } from '../utils'

class Rect {
  x = 0
  y = 0
  w = 0
  h = 0
}

export abstract class BaseSprite {
  rect = new Rect()

  visible = true

  zIndex = 0

  constructor (public name: string) {}

  abstract render (ctx: CanvasRenderingContext2D): void

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
