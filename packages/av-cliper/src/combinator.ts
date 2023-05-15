import { OffscreenSprite } from './offscreen-sprite'
import { file2stream, recodemux } from './mp4-utils'
import { Log } from './log'
import { mixPCM } from './av-utils'

interface IComItem {
  offset: number
  duration: number
  sprite: OffscreenSprite
}

interface ICombinatorOpts {
  width: number
  height: number
  bgColor?: string
}

export class Combinator {
  static isSupported (): boolean {
    return (
      self.OffscreenCanvas != null &&
      self.OfflineAudioContext != null &&
      self.VideoEncoder != null &&
      self.VideoDecoder != null &&
      self.VideoFrame != null &&
      self.AudioEncoder != null &&
      self.AudioDecoder != null &&
      self.AudioData != null
    )
  }

  #comItems: IComItem[] = []

  #ts = 0

  #cvs

  #ctx

  #closeOutStream: (() => void) | null = null

  #remux

  #opts

  constructor (opts: ICombinatorOpts) {
    const { width, height } = opts
    this.#cvs = new OffscreenCanvas(width, height)
    // this.#cvs = document.querySelector('#canvas') as HTMLCanvasElement
    const ctx = this.#cvs.getContext('2d', { alpha: false })
    if (ctx == null) throw Error('Can not create 2d offscreen context')
    this.#ctx = ctx
    this.#opts = Object.assign({ bgColor: '#000' }, opts)

    console.time('cost')
    this.#remux = recodemux(
      {
        video: {
          width,
          height,
          expectFPS: 30
        },
        audio: {
          codec: 'aac',
          sampleRate: 48000,
          sampleSize: 16,
          channelCount: 2
        },
        bitrate: 1_500_000
      },
      {
        onEnded: () => {
          Log.info(`===== output ended ====== ${this.#ts}`)
          this.#closeOutStream?.()
          console.timeEnd('cost')
          this.#comItems.forEach(it => it.sprite.destroy())
        }
      }
    )
  }

  async add (
    sprite: OffscreenSprite,
    opts: { offset: number; duration: number }
  ): Promise<void> {
    await sprite.ready
    this.#comItems.push({
      sprite,
      offset: opts.offset * 1e6,
      duration: opts.duration * 1e6
    })
    this.#comItems.sort((a, b) => a.sprite.zIndex - b.sprite.zIndex)
  }

  output (): ReadableStream<ArrayBuffer> {
    if (this.#comItems.length === 0) throw Error('No clip added')

    const runState = {
      cancel: false
    }
    this.#run(runState).catch(Log.error)

    const { stream, stop: closeOutStream } = file2stream(
      this.#remux.mp4file,
      500,
      () => {
        runState.cancel = true
        this.#remux.close()
      }
    )
    this.#closeOutStream = closeOutStream

    return stream
  }

  async #run (state: { cancel: boolean }): Promise<void> {
    // 33ms ≈ 30FPS
    const timeSlice = 33 * 1000
    const maxTime = Math.max(
      ...this.#comItems.map(it => it.offset + it.duration)
    )

    let frameCnt = 0
    const { width, height } = this.#cvs
    const ctx = this.#ctx
    while (this.#ts <= maxTime) {
      if (state.cancel) break

      ctx.fillStyle = this.#opts.bgColor
      ctx.fillRect(0, 0, width, height)

      const audios = []
      for (const it of this.#comItems) {
        if (this.#ts < it.offset || this.#ts > it.offset + it.duration) {
          continue
        }

        ctx.save()
        audios.push(await it.sprite.offscreenRender(ctx, this.#ts - it.offset))
        ctx.restore()
      }

      if (audios.flat().every(a => a.length === 0)) {
        // 当前时刻无音频时，使用无声音频占位，否则会导致后续音频播放时间偏差
        this.#remux.encodeAudio(createAudioPlaceholder(this.#ts, timeSlice))
      } else {
        const data = mixPCM(audios)
        this.#remux.encodeAudio(
          new AudioData({
            timestamp: this.#ts,
            numberOfChannels: 2,
            numberOfFrames: data.length / 2,
            sampleRate: 48000,
            format: 'f32-planar',
            data
          })
        )
      }
      const vf = new VideoFrame(this.#cvs, {
        duration: timeSlice,
        timestamp: this.#ts
      })
      this.#ts += timeSlice

      this.#remux.encodeVideo(vf, {
        keyFrame: frameCnt % 150 === 0
      })
      ctx.resetTransform()
      ctx.clearRect(0, 0, width, height)

      frameCnt += 1
    }
  }
}

function createAudioPlaceholder (ts: number, duration: number): AudioData {
  const frameCnt = Math.floor((48000 * duration) / 1e6)
  return new AudioData({
    timestamp: ts,
    numberOfChannels: 2,
    numberOfFrames: frameCnt,
    sampleRate: 48000,
    format: 'f32-planar',
    data: new Float32Array(frameCnt * 2)
  })
}
