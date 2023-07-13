import { BaseSprite } from './base-sprite'
import { IClip } from './clips'
import { Log } from './log'

export class OffscreenSprite extends BaseSprite {
  #clip: IClip
  ready: Promise<void>

  // 保持最近一帧，若 clip 在当前帧无数据，则绘制最近一帧
  #lastVf: VideoFrame | ImageBitmap | null = null

  /**
   * 在视频帧的持续时长
   */
  duration = Infinity

  #destroyed = false

  constructor (name: string, clip: IClip) {
    super(name)
    this.#clip = clip
    this.ready = clip.ready.then(({ width, height, duration }) => {
      this.rect.w = width
      this.rect.h = height
      this.duration = duration
    })
  }

  async offscreenRender (
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    time: number
  ): Promise<{
    audio: Float32Array[]
    done: boolean
  }> {
    this.animate(time)
    super.render(ctx)
    const { w, h } = this.rect
    const { video, audio, state } = await this.#clip.tick(time)
    if (state === 'done') {
      return {
        audio: audio ?? [],
        done: true
      }
    }

    const imgSource = video ?? this.#lastVf
    if (imgSource != null) {
      ctx.drawImage(imgSource, -w / 2, -h / 2, w, h)
    }

    if (video != null) {
      this.#lastVf?.close()
      this.#lastVf = video
    }

    return {
      audio: audio ?? [],
      done: false
    }
  }

  destroy (): void {
    if (this.#destroyed) return
    this.#destroyed = true

    Log.info(`OffscreenSprite ${this.name} destroy`)
    this.#lastVf?.close()
    this.#lastVf = null
    this.#clip.destroy()
  }
}
