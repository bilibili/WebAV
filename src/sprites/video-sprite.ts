import { BaseSprite } from './base-sprite'

interface IVideoSpriteOpts {
  audioCtx?: AudioContext
}

export class VideoSprite extends BaseSprite {
  #videoEl: HTMLVideoElement | null = null

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
      const audioSource = opts.audioCtx.createMediaStreamSource(audioMS)
      this.audioNode = opts.audioCtx.createGain()
      audioSource.connect(this.audioNode)
    }
  }

  render (ctx: CanvasRenderingContext2D): void {
    if (this.#videoEl == null) return
    super.render(ctx)
    const { w, h } = this.rect
    ctx.drawImage(this.#videoEl, -w / 2, -h / 2, w, h)
    ctx.resetTransform()
  }

  get volume (): number {
    return this.audioNode?.gain.value ?? 0
  }

  set volume (v: number) {
    if (this.audioNode == null) return
    this.audioNode.gain.value = v
  }

  destory (): void {
    this.#videoEl?.remove()
    this.#videoEl = null
  }
}

async function mediaStream2Video (
  stream: MediaStream
): Promise<HTMLVideoElement> {
  const video = document.createElement('video')

  let timer: number

  video.srcObject = stream

  return await new Promise((resolve, reject) => {
    let failed = false
    video.addEventListener('loadeddata', () => {
      if (failed) return
      clearTimeout(timer)
      resolve(video)
    })
    timer = window.setTimeout(() => {
      failed = true
      reject(new Error('video load failed'))
    }, 2000)
  })
}
