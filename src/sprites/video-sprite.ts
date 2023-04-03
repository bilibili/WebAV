import { mediaStream2Video } from '../utils'
import { BaseSprite } from './base-sprite'

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
    super.render(ctx)
    const { w, h } = this.rect
    ctx.drawImage(this.#videoEl, -w / 2, -h / 2, w, h)
    ctx.resetTransform()
  }

  destory (): void {
    this.#videoEl?.remove()
    this.#videoEl = null
  }
}
