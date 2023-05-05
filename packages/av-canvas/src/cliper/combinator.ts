import { WorkerSprite } from './worker-sprite'
import { file2stream, stereoFixedAudioData, recodemux } from './mp4-utils'

interface IComItem {
  offset: number
  duration: number
  sprite: WorkerSprite
}

// todo: 编码、canvas 应从 Timeline中剥离
export class Combinator {
  #timeItems: IComItem[] = []

  #ts = 0

  #cvs

  #ctx

  #closeOutStream: (() => void) | null = null

  #remux

  constructor (resolutions: { width: number, height: number }) {
    const { width, height } = resolutions
    this.#cvs = new OffscreenCanvas(width, height)
    // this.#cvs = document.querySelector('#canvas') as HTMLCanvasElement
    const ctx = this.#cvs.getContext('2d', { alpha: false })
    if (ctx == null) throw Error('Can not create 2d offscreen context')
    this.#ctx = ctx

    console.time('cost')
    this.#remux = recodemux({
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
    }, {
      onEnded: () => {
        console.log('===== output ended ======', this.#ts)
        this.#closeOutStream?.()
        console.timeEnd('cost')
        this.#timeItems.forEach(it => it.sprite.destroy())
      }
    })
  }

  async add (
    sprite: WorkerSprite,
    opts: { offset: number, duration: number }
  ): Promise<void> {
    await sprite.ready
    // const { rect } = sprite
    // if (rect.x === 0 && rect.y === 0) {
    //   // 默认居中
    //   rect.x = (this.#cvs.width - rect.w) / 2
    //   rect.y = (this.#cvs.height - rect.h) / 2
    // }

    this.#timeItems.push({
      sprite,
      offset: opts.offset * 1e6,
      duration: opts.duration * 1e6
    })
  }

  output (): ReadableStream<ArrayBuffer> {
    const lastIt = this.#timeItems.at(-1)
    if (lastIt == null) throw Error('Timeline is empty')
    const maxTime = Math.max(
      ...this.#timeItems.map(it => it.offset + it.duration)
    )

    // 33ms, 30FPS
    const timeSlice = 33 * 1000
    let canceled = false
    const run = async (): Promise<void> => {
      let frameCnt = 0
      while (this.#ts <= maxTime) {
        if (canceled) break

        let audioCnt = 0
        for (const it of this.#timeItems) {
          if (this.#ts < it.offset || this.#ts > it.offset + it.duration) {
            continue
          }
          const audioDataArr = await it.sprite.offscreenRender(
            this.#ctx,
            this.#ts - it.offset
          )

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
        // console.log(4444, vf.duration)

        this.#remux.encodeVideo(vf, {
          keyFrame: frameCnt % 150 === 0
        })
        this.#ctx.resetTransform()
        this.#ctx.clearRect(0, 0, this.#cvs.width, this.#cvs.height)

        frameCnt += 1
      }
    }

    run().catch(console.error)

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
  const frameCnt = Math.floor(48000 * duration / 1e6)
  return new AudioData({
    timestamp: ts,
    numberOfChannels: 2,
    numberOfFrames: frameCnt,
    sampleRate: 48000,
    format: 'f32-planar',
    data: new Float32Array(frameCnt * 2)
  })
}
