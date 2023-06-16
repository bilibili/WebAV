import { OffscreenSprite } from './offscreen-sprite'
import { file2stream, recodemux } from './mp4-utils'
import { Log } from './log'
import { mixinPCM, sleep } from './av-utils'
import { EventTool } from './event-tool'
import { DEFAULT_AUDIO_SAMPLE_RATE } from './clips'

interface IComItem {
  offset: number
  duration: number
  sprite: OffscreenSprite
  /**
   * main 资源时间结束时会终结合并流程；
   * 比如合并 mp4（main） + mp3 + img， 所有资源可以缺省持续时间（duration）；
   * mp4（main）时间终点会终结合并流程
   */
  main: boolean
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
    opts: { offset?: number; duration?: number; main?: boolean } = {}
  ): Promise<void> {
    Log.info('Combinator add sprite:', sprite.name)
    await sprite.ready
    Log.info('Combinator add sprite ready:', sprite.name)
    this.#comItems.push({
      sprite,
      offset: (opts.offset ?? 0) * 1e6,
      duration: opts.duration == null ? sprite.duration : opts.duration * 1e6,
      main: opts.main ?? false
    })
    this.#comItems.sort((a, b) => a.sprite.zIndex - b.sprite.zIndex)
  }

  output (): ReadableStream<Uint8Array> {
    if (this.#comItems.length === 0) throw Error('No clip added')

    const mainItem = this.#comItems.find(it => it.main)
    // 最大时间，优先取 main sprite，不存在则取最大值
    const maxTime =
      mainItem != null
        ? mainItem.offset + mainItem.duration
        : Math.max(...this.#comItems.map(it => it.offset + it.duration))

    if (maxTime === Infinity) {
      throw Error(
        'Unable to determine the end time, please specify a main sprite, or limit the duration of ImgClip, AudioCli'
      )
    }
    if (maxTime === -1) {
      Log.warn("Unable to determine the end time, process value don't update")
    }

    let remuxEndTimer = 0
    const stopReCodeMux = this.#run(
      maxTime,
      prog => {
        this.#evtTool.emit('OutputProgress', prog)
      },
      () => {
        remuxEndTimer = setInterval(() => {
          if (this.#remux.getEecodeQueueSize() === 0) {
            clearInterval(remuxEndTimer)
            Log.info('===== output ended ======')
            this.#closeOutStream?.()
            console.timeEnd('cost')
            this.#evtTool.emit('OutputProgress', 1)
          }
        }, 100)
      }
    )

    const { stream, stop: closeOutStream } = file2stream(
      this.#remux.mp4file,
      500,
      () => {
        clearInterval(remuxEndTimer)
        stopReCodeMux()
        this.#remux.close()
      }
    )
    this.#closeOutStream = closeOutStream

    return stream
  }

  #run (
    maxTime: number,
    onprogress: (prog: number) => void,
    onEnded: () => void
  ): () => void {
    let inputProgress = 0
    let stoped = false

    const _run = async () => {
      // 33ms ≈ 30FPS
      const timeSlice = 33 * 1000

      let frameCnt = 0
      const { width, height } = this.#cvs
      const ctx = this.#ctx
      let ts = 0
      while (true) {
        inputProgress = ts / maxTime
        if (stoped || this.#comItems.length === 0) {
          this.#comItems.forEach(it => it.sprite.destroy())
          exit()
          onEnded()
          return
        }

        ctx.fillStyle = this.#opts.bgColor
        ctx.fillRect(0, 0, width, height)

        const audios: Float32Array[][] = []
        for (let i = 0; i < this.#comItems.length; i++) {
          const it = this.#comItems[i]
          if (ts < it.offset) continue

          ctx.save()
          const { audio, done } = await it.sprite.offscreenRender(
            ctx,
            ts - it.offset
          )
          audios.push(audio)
          ctx.restore()

          // 超过设定时间主动掐断，或资源结束
          if ((it.duration > 0 && ts > it.offset + it.duration) || done) {
            if (it.main) {
              this.#comItems.forEach(it => it.sprite.destroy())
              exit()
              onEnded()
              return
            }

            it.sprite.destroy()
            this.#comItems.splice(i, 1)
          }
        }

        // Log.debug('combinator run, ts:', ts, ' audio track count:', audios.length)
        if (audios.flat().every(a => a.length === 0)) {
          // 当前时刻无音频时，使用无声音频占位，否则会导致后续音频播放时间偏差
          this.#remux.encodeAudio(
            createAudioPlaceholder(ts, timeSlice, DEFAULT_AUDIO_SAMPLE_RATE)
          )
        } else {
          const data = mixinPCM(audios)
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
        if (this.#remux.getEecodeQueueSize() > 150) {
          while (true) {
            const qSize = this.#remux.getEecodeQueueSize()
            if (qSize < 50) break
            // 根据大小动态调整等待时间，减少 while 循环次数
            await sleep(qSize)
          }
        }
      }
    }

    _run().catch(Log.error)

    let maxEncodeQSize = 0
    let outProgress = 0
    // 避免 进度值 回退
    let lastProg = 0
    const outProgTimer = setInterval(() => {
      const s = this.#remux.getEecodeQueueSize()
      maxEncodeQSize = Math.max(maxEncodeQSize, s)
      outProgress = s / maxEncodeQSize
      lastProg = Math.max(outProgress * 0.5 + inputProgress * 0.5, lastProg)
      onprogress(lastProg)
    }, 500)

    function exit () {
      clearInterval(outProgTimer)
      stoped = true
    }

    return exit
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
