import { OffscreenSprite } from './offscreen-sprite'
import { file2stream, recodemux } from './mp4-utils'
import { Log } from './log'
import { mixPCM, sleep } from './av-utils'
import { EventTool } from './event-tool'
import { DEFAULT_AUDIO_SAMPLE_RATE } from './clips'

interface IComItem {
  offset: number
  duration: number
  sprite: OffscreenSprite
}

interface ICombinatorOpts {
  width: number
  height: number
  bitrate?: number
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

  #cvs

  #ctx

  #closeOutStream: (() => void) | null = null

  #remux

  #opts

  #evtTool = new EventTool<{
    OutputProgress: (progress: number) => void
  }>()
  on = this.#evtTool.on

  constructor (opts: ICombinatorOpts) {
    const { width, height } = opts
    this.#cvs = new OffscreenCanvas(width, height)
    // this.#cvs = document.querySelector('#canvas') as HTMLCanvasElement
    const ctx = this.#cvs.getContext('2d', { alpha: false })
    if (ctx == null) throw Error('Can not create 2d offscreen context')
    this.#ctx = ctx
    this.#opts = Object.assign({ bgColor: '#000' }, opts)

    console.time('cost')
    this.#remux = recodemux({
      video: {
        width,
        height,
        expectFPS: 30
      },
      audio: {
        codec: 'aac',
        sampleRate: DEFAULT_AUDIO_SAMPLE_RATE,
        sampleSize: 16,
        channelCount: 2
      },
      bitrate: opts.bitrate ?? 2_000_000
    })
  }

  async add (
    sprite: OffscreenSprite,
    opts: { offset: number; duration?: number }
  ): Promise<void> {
    Log.info('Combinator add sprite:', sprite.name)
    await sprite.ready
    Log.info('Combinator add sprite ready:', sprite.name)
    this.#comItems.push({
      sprite,
      offset: opts.offset * 1e6,
      duration: opts.duration == null ? -1 : opts.duration * 1e6
    })
    this.#comItems.sort((a, b) => a.sprite.zIndex - b.sprite.zIndex)
  }

  output (): ReadableStream<Uint8Array> {
    if (this.#comItems.length === 0) throw Error('No clip added')

    const runState = {
      cancel: false,
      progress: 0
    }
    this.#run(runState).catch(Log.error)

    const stopProg = this.#updateProgress(runState)
    this.#remux.onEnded = () => {
      Log.info('===== output ended ======')
      this.#closeOutStream?.()
      console.timeEnd('cost')
      stopProg()
    }
    const { stream, stop: closeOutStream } = file2stream(
      this.#remux.mp4file,
      500,
      () => {
        runState.cancel = true
        this.#remux.close()
        stopProg()
      }
    )
    this.#closeOutStream = closeOutStream

    return stream
  }

  async #run (state: { cancel: boolean; progress: number }): Promise<void> {
    // 33ms ≈ 30FPS
    const timeSlice = 33 * 1000
    const maxTime = Math.max(
      ...this.#comItems.map(it => it.offset + it.duration)
    )

    let frameCnt = 0
    const { width, height } = this.#cvs
    const ctx = this.#ctx
    let ts = 0
    while (ts <= maxTime) {
      state.progress = ts / maxTime
      if (state.cancel) break

      ctx.fillStyle = this.#opts.bgColor
      ctx.fillRect(0, 0, width, height)

      const audios: Float32Array[][] = []
      for (let i = 0; i < this.#comItems.length; i++) {
        const it = this.#comItems[i]
        if (ts < it.offset) continue
        // 超过设定时间，主动掐断
        if (it.duration > 0 && ts > it.offset + it.duration) {
          it.sprite.destroy()
          this.#comItems.splice(i, 1)
          continue
        }

        ctx.save()
        audios.push(await it.sprite.offscreenRender(ctx, ts - it.offset))
        ctx.restore()
      }

      Log.debug('combinator run, ts:', ts, ' audio track count:', audios.length)
      if (audios.flat().every(a => a.length === 0)) {
        // 当前时刻无音频时，使用无声音频占位，否则会导致后续音频播放时间偏差
        this.#remux.encodeAudio(
          createAudioPlaceholder(ts, timeSlice, DEFAULT_AUDIO_SAMPLE_RATE)
        )
      } else {
        const data = mixPCM(audios)
        this.#remux.encodeAudio(
          new AudioData({
            timestamp: ts,
            numberOfChannels: 2,
            numberOfFrames: data.length / 2,
            sampleRate: DEFAULT_AUDIO_SAMPLE_RATE,
            format: 'f32-planar',
            data
          })
        )
      }
      const vf = new VideoFrame(this.#cvs, {
        duration: timeSlice,
        timestamp: ts
      })
      ts += timeSlice

      this.#remux.encodeVideo(vf, {
        keyFrame: frameCnt % 150 === 0
      })
      ctx.resetTransform()
      ctx.clearRect(0, 0, width, height)

      frameCnt += 1
      // VideoFrame 非常占用 GPU 显存，避免显存压力过大，稍等一下整体性能更优
      if (this.#remux.getEecodeQueueSize().video > 100) await sleep(5)
    }

    this.#comItems.forEach(it => it.sprite.destroy())
  }

  #updateProgress (mixinState: { progress: number }): () => void {
    // fixme: 进度值错误
    const timer = setInterval(() => {
      this.#evtTool.emit(
        'OutputProgress',
        mixinState.progress * 0.5 + this.#remux.progress * 0.5
      )
    }, 500)
    return () => {
      clearInterval(timer)
      this.#evtTool.emit('OutputProgress', 1)
    }
  }
}

function createAudioPlaceholder (
  ts: number,
  duration: number,
  sampleRate: number
): AudioData {
  const frameCnt = Math.floor((sampleRate * duration) / 1e6)
  return new AudioData({
    timestamp: ts,
    numberOfChannels: 2,
    numberOfFrames: frameCnt,
    sampleRate: sampleRate,
    format: 'f32-planar',
    data: new Float32Array(frameCnt * 2)
  })
}
