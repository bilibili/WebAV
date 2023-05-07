import { BaseSprite } from './base-sprite'
import { IClip } from './clips'

export class OffscreenSprite extends BaseSprite {
  #clip: IClip
  ready: Promise<void>

  #lastVf: VideoFrame | ImageBitmap | null = null

  constructor (name: string, clip: IClip) {
    super(name)
    this.#clip = clip
    this.ready = clip.ready.then(() => {
      console.log('--- WorkerSprite ready ---', clip.meta)
      this.rect.w = clip.meta.width
      this.rect.h = clip.meta.height
    })
  }

  async offscreenRender (
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    time: number
  ): Promise<AudioData[]> {
    this.animate(time)
    super.render(ctx)
    const { w, h } = this.rect
    const { video, audio, state } = await this.#clip.tick(time)
    if (state === 'done') return []

    const imgSource = video ?? this.#lastVf
    if (imgSource != null) {
      ctx.drawImage(imgSource, -w / 2, -h / 2, w, h)
    }

    if (video != null) {
      this.#lastVf?.close()
      this.#lastVf = video
    }

    return audio
  }

  destroy (): void {
    this.#lastVf?.close()
    this.#lastVf = null
    this.#clip.destroy()
  }
}
