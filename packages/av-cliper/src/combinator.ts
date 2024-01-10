import { OffscreenSprite } from './offscreen-sprite'
import { file2stream, recodemux } from './mp4-utils'
import { Log } from './log'
import { mixinPCM, sleep, throttle } from './av-utils'
import { EventTool } from './event-tool'
import { DEFAULT_AUDIO_CONF } from './clips'

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
  videoCodec?: string
}

let COM_ID = 0

let TOTAL_COM_ENCODE_QSIZE = new Map<Combinator, () => number>()
/**
 * 控制全局 encode queue size
 * 避免多个 Combinator 并行，导致显存溢出
 */
const encoderIdle = (() => {
  let totalQSize = 0

  const updateQS = throttle(() => {
    let ts = 0
    for (const getQSize of TOTAL_COM_ENCODE_QSIZE.values()) {
      ts += getQSize()
    }
    totalQSize = ts
  }, 10)

  return async function encoderIdle() {
    updateQS()
    if (totalQSize > 100) {
      // VideoFrame 非常占用 GPU 显存，避免显存压力过大，稍等一下整体性能更优
      await sleep(totalQSize)
      updateQS()
      if (totalQSize < 50) return

      await encoderIdle()
    }
  }
})()

export class Combinator {
  static async isSupported(args = {
    videoCodec: 'avc1.42E032'
  }): Promise<boolean> {
    return (
      self.OffscreenCanvas != null &&
      self.VideoEncoder != null &&
      self.VideoDecoder != null &&
      self.VideoFrame != null &&
      self.AudioEncoder != null &&
      self.AudioDecoder != null &&
      self.AudioData != null &&
      ((
        await self.VideoEncoder.isConfigSupported({
          codec: args.videoCodec,
          width: 1280,
          height: 720
        })
      ).supported ??
        false) &&
      (
        await self.AudioEncoder.isConfigSupported({
          codec: DEFAULT_AUDIO_CONF.codec,
          sampleRate: DEFAULT_AUDIO_CONF.sampleRate,
          numberOfChannels: DEFAULT_AUDIO_CONF.channelCount
        })
      ).supported
    )
  }

  #log = Log.create(`id:${COM_ID++},`)

  #destroyed = false

  #comItems: IComItem[] = []

  #cvs

  #ctx

  // 中断输出
  #stopOutput: (() => void) | null = null

  #remux

  #opts

  #evtTool = new EventTool<{
    OutputProgress: (progress: number) => void
  }>()
  on = this.#evtTool.on

  constructor(opts: ICombinatorOpts) {
    const { width, height } = opts
    this.#cvs = new OffscreenCanvas(width, height)
    // this.#cvs = document.querySelector('#canvas') as HTMLCanvasElement
    const ctx = this.#cvs.getContext('2d', { alpha: false })
    if (ctx == null) throw Error('Can not create 2d offscreen context')
    this.#ctx = ctx
    this.#opts = Object.assign({ bgColor: '#000' }, opts)

    this.#remux = recodemux({
      video: {
        width,
        height,
        expectFPS: 30,
        codec: opts.videoCodec ?? 'avc1.42E032'
      },
      audio: {
        codec: 'aac',
        sampleRate: DEFAULT_AUDIO_CONF.sampleRate,
        channelCount: DEFAULT_AUDIO_CONF.channelCount
      },
      bitrate: opts.bitrate ?? 2_000_000
    })

    TOTAL_COM_ENCODE_QSIZE.set(this, this.#remux.getEecodeQueueSize)
  }

  async add(
    sprite: OffscreenSprite,
    opts: { offset?: number; duration?: number; main?: boolean } = {}
  ): Promise<void> {
    this.#log.info('Combinator add sprite:', sprite.name)
    await sprite.ready
    this.#log.info('Combinator add sprite ready:', sprite.name)
    this.#comItems.push({
      sprite,
      offset: (opts.offset ?? 0) * 1e6,
      duration: opts.duration == null ? sprite.duration : opts.duration * 1e6,
      main: opts.main ?? false
    })
    this.#comItems.sort((a, b) => a.sprite.zIndex - b.sprite.zIndex)
  }

  output(): ReadableStream<Uint8Array> {
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
    // 主视频（main）的 videoTrack duration 值为 0
    if (maxTime === -1) {
      this.#log.warn(
        "Unable to determine the end time, process value don't update"
      )
    }

    let starTime = performance.now()
    const stopReCodeMux = this.#run(
      maxTime,
      prog => {
        this.#log.debug('OutputProgress:', prog)
        this.#evtTool.emit('OutputProgress', prog)
      },
      async () => {
        await this.#remux.flush()
        this.#log.info(
          '===== output ended =====, cost:',
          performance.now() - starTime
        )
        this.#evtTool.emit('OutputProgress', 1)
        this.destroy()
      }
    )

    this.#stopOutput = () => {
      stopReCodeMux()
      this.#remux.close()
      closeOutStream()
    }
    const { stream, stop: closeOutStream } = file2stream(
      this.#remux.mp4file,
      500,
      this.destroy
    )

    return stream
  }

  destroy() {
    if (this.#destroyed) return
    this.#destroyed = true

    TOTAL_COM_ENCODE_QSIZE.delete(this)
    this.#stopOutput?.()
    this.#evtTool.destroy()
  }

  #run(
    maxTime: number,
    onprogress: (prog: number) => void,
    onEnded: () => Promise<void>
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
        if (
          stoped ||
          (maxTime === -1 ? false : ts > maxTime) ||
          this.#comItems.length === 0
        ) {
          exit()
          await onEnded()
          return
        }
        inputProgress = ts / maxTime

        ctx.fillStyle = this.#opts.bgColor
        ctx.fillRect(0, 0, width, height)

        const audios: Float32Array[][] = []
        for (let i = 0; !stoped && i < this.#comItems.length; i++) {
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
              exit()
              await onEnded()
              return
            }

            it.sprite.destroy()
            this.#comItems.splice(i, 1)
          }
        }

        if (stoped) return

        if (audios.flat().every(a => a.length === 0)) {
          // 当前时刻无音频时，使用无声音频占位，否则会导致后续音频播放时间偏差
          this.#remux.encodeAudio(
            createAudioPlaceholder(ts, timeSlice, DEFAULT_AUDIO_CONF.sampleRate)
          )
        } else {
          const data = mixinPCM(audios)
          this.#remux.encodeAudio(
            new AudioData({
              timestamp: ts,
              numberOfChannels: DEFAULT_AUDIO_CONF.channelCount,
              numberOfFrames: data.length / DEFAULT_AUDIO_CONF.channelCount,
              sampleRate: DEFAULT_AUDIO_CONF.sampleRate,
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

        await encoderIdle()
      }
    }

    _run().catch(this.#log.error)

    // 初始 1 避免 NaN
    let maxEncodeQSize = 1
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

    const exit = () => {
      if (stoped) return
      stoped = true
      clearInterval(outProgTimer)
      this.#comItems.forEach(it => it.sprite.destroy())
    }

    return exit
  }
}

function createAudioPlaceholder(
  ts: number,
  duration: number,
  sampleRate: number
): AudioData {
  const frameCnt = Math.floor((sampleRate * duration) / 1e6)
  return new AudioData({
    timestamp: ts,
    numberOfChannels: DEFAULT_AUDIO_CONF.channelCount,
    numberOfFrames: frameCnt,
    sampleRate: sampleRate,
    format: 'f32-planar',
    data: new Float32Array(frameCnt * 2)
  })
}
