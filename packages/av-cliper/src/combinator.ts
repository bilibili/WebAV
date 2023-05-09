import { OffscreenSprite } from './offscreen-sprite'
import { file2stream, stereoFixedAudioData, recodemux } from './mp4-utils'
import { Log } from './log'

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
    const lastIt = this.#comItems.at(-1)
    if (lastIt == null) throw Error('Timeline is empty')
    const maxTime = Math.max(
      ...this.#comItems.map(it => it.offset + it.duration)
    )

    // 33ms, 30FPS
    const timeSlice = 33 * 1000
    let canceled = false
    const run = async (): Promise<void> => {
      let frameCnt = 0
      const { width, height } = this.#cvs
      const ctx = this.#ctx
      while (this.#ts <= maxTime) {
        if (canceled) break

        ctx.fillStyle = this.#opts.bgColor
        ctx.fillRect(0, 0, width, height)

        let audioCnt = 0
        for (const it of this.#comItems) {
          if (this.#ts < it.offset || this.#ts > it.offset + it.duration) {
            continue
          }

          ctx.save()
          const audioDataArr = await it.sprite.offscreenRender(
            ctx,
            this.#ts - it.offset
          )
          ctx.restore()

          for (const ad of audioDataArr) {
            // 此处看起来需要重置 timestamp，实际上不重置似乎也没有 bug，chrome、quicktime播放正常
            this.#remux.encodeAudio(
              // 若channelCount不同，无法通过编码
              stereoFixedAudioData(ad)
            )
          }
          audioCnt += audioDataArr.length
        }
        if (audioCnt === 0) {
          // 当前时刻无音频时，使用无声音频占位，否则会导致后续音频播放时间偏差
          this.#remux.encodeAudio(createAudioPlaceholder(this.#ts, timeSlice))
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

    run().catch(Log.error)

    const { stream, stop: closeOutStream } = file2stream(
      this.#remux.mp4file,
      500,
      () => {
        canceled = true
        this.#remux.close()
      }
    )
    this.#closeOutStream = closeOutStream

    return stream
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
