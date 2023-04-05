import { createEl, mediaStream2Video } from '../utils'
import { BaseSprite } from './base-sprite'

interface IVideoSpriteOpts {
  audioCtx?: AudioContext
}

export class VideoSprite extends BaseSprite {
  #videoEl: HTMLVideoElement | null = null
  #audioEl: HTMLAudioElement | null = null

  constructor (name: string, source: MediaStream, opts: IVideoSpriteOpts = {}) {
    super(name)
    this.initReady = this.#init(source, opts)
  }

  async #init (ms: MediaStream, opts: IVideoSpriteOpts): Promise<void> {
    const audioMS = new MediaStream()
    ms.getAudioTracks().forEach((track) => {
      // 给视频消音
      ms.removeTrack(track)
      audioMS.addTrack(track)
    })

    this.#videoEl = await mediaStream2Video(ms)
    await this.#videoEl.play()

    this.rect.w = this.#videoEl.videoWidth
    this.rect.h = this.#videoEl.videoHeight

    if (opts.audioCtx != null && audioMS.getAudioTracks().length > 0) {
      const audioEl = createEl('audio') as HTMLAudioElement
      audioEl.srcObject = audioMS
      await audioEl.play()
      this.#audioEl = audioEl
      this.audioNode = opts.audioCtx.createMediaElementSource(audioEl)
    }
  }

  render (ctx: CanvasRenderingContext2D): void {
    if (this.#videoEl == null) return
    super.render(ctx)
    const { w, h } = this.rect
    ctx.drawImage(this.#videoEl, -w / 2, -h / 2, w, h)
    ctx.resetTransform()
  }

  pause (): void {
    this.#videoEl?.pause()
    this.#audioEl?.pause()
  }

  async play (): Promise<void> {
    await this.#videoEl?.play()
    await this.#audioEl?.play()
  }

  get volume (): number {
    return this.#audioEl?.volume ?? 0
  }

  set volume (v: number) {
    if (this.#audioEl == null) return
    this.#audioEl.volume = v
  }

  destory (): void {
    this.#videoEl?.remove()
    this.#videoEl = null
    this.#audioEl?.remove()
    this.#audioEl = null
  }
}
