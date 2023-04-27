import mp4box, { MP4File } from 'mp4box'
import { WorkerSprite } from './worker-sprite'

interface ITimeItem {
  offset: number
  duration: number
  sprite: WorkerSprite
}

// todo: 编码、canvas 应从 Timeline中剥离
export class Timeline {
  #timeItems: ITimeItem[] = []

  #ts = 0

  #cvs

  #ctx
  #videoEncoder: VideoEncoder

  #mp4file: MP4File

  #stopVideoEncoder: () => Promise<void>

  constructor (resolutions: { width: number, height: number }) {
    const { width, height } = resolutions
    this.#cvs = new OffscreenCanvas(width, height)
    // this.#cvs = document.querySelector('#canvas') as HTMLCanvasElement
    const ctx = this.#cvs.getContext('2d', { alpha: false })
    if (ctx == null) throw Error('Can not create 2d offscreen context')
    this.#ctx = ctx
    // ctx.fillStyle = "#ff0000"
    // ctx.fillRect(0, 0, 1280, 720)

    this.#mp4file = mp4box.createFile()
    const { stop, encoder } = encodeVideoTrack({
      video: {
        width,
        height,
        expectFPS: 30
      },
      bitrate: 1_500_000
    }, this.#mp4file, () => {})
    this.#videoEncoder = encoder
    this.#stopVideoEncoder = stop
  }

  async add (
    sprite: WorkerSprite,
    opts: { offset: number, duration: number }
  ): Promise<void> {
    await sprite.ready
    this.#timeItems.push({
      sprite,
      ...opts
    })
  }

  output (): ReadableStream<ArrayBuffer> {
    const lastIt = this.#timeItems.at(-1)
    if (lastIt == null) throw Error('Timeline is empty')
    const maxTime = lastIt.offset + lastIt.duration

    // 33ms, 30FPS
    const timeSlice = 33 * 1000
    let canceled = false
    const run = async (): Promise<void> => {
      let frameCnt = 0
      while (this.#ts <= maxTime) {
        if (canceled) break

        for (const it of this.#timeItems) {
          if (this.#ts < it.offset || this.#ts > it.offset + it.duration) {
            continue
          }
          await it.sprite.offscreenRender(this.#ctx, this.#ts - it.offset)
        }
        const vf = new VideoFrame(this.#cvs, {
          duration: timeSlice,
          timestamp: this.#ts
        })
        this.#ts += timeSlice
        // console.log(4444, vf.duration)

        this.#videoEncoder.encode(vf, {
          keyFrame: frameCnt % 150 === 0
        })
        vf.close()
        this.#ctx.resetTransform()
        this.#ctx.clearRect(0, 0, this.#cvs.width, this.#cvs.height)

        frameCnt += 1
      }
    }

    console.time('cost')
    this.#videoEncoder.ondequeue = () => {
      if (this.#videoEncoder.encodeQueueSize === 0) {
        console.log('===== output ended ======', this.#ts, maxTime)
        stopFileStream()
        console.timeEnd('cost')
      }
    }

    run().catch(console.error)

    const { stream, stop: stopFileStream } = convertFile2Stream(this.#mp4file, 500, () => {
      canceled = true
      this.#videoEncoder.flush().catch(console.error)
      // this.#videoEncoder.reset()
    })

    return stream
  }
}

type TCleanFn = () => void

interface IWorkerOpts {
  video: {
    width: number
    height: number
    expectFPS: number
  }
  // audio: {
  //   codec: 'opus' | 'aac'
  //   sampleRate: number
  //   sampleSize: number
  //   channelCount: number
  // } | null
  bitrate: number
}

function encodeVideoTrack (
  opts: IWorkerOpts,
  mp4File: MP4File,
  onTrackReady: TCleanFn
): {
    stop: () => Promise<void>
    encoder: VideoEncoder
  } {
  const videoTrackOpts = {
    // 微秒
    timescale: 1e6,
    width: opts.video.width,
    height: opts.video.height,
    brands: ['isom', 'iso2', 'avc1', 'mp41'],
    avcDecoderConfigRecord: null as AllowSharedBufferSource | undefined | null
  }

  let vTrackId: number
  const encoder = createVideoEncoder(opts, (chunk, meta) => {
    if (vTrackId == null && meta != null) {
      videoTrackOpts.avcDecoderConfigRecord = meta.decoderConfig?.description
      vTrackId = mp4File.addTrack(videoTrackOpts)

      // start encodeAudioTrack
      onTrackReady()
    }
    const buf = new ArrayBuffer(chunk.byteLength)
    chunk.copyTo(buf)
    const dts = chunk.timestamp

    mp4File.addSample(
      vTrackId,
      buf,
      {
        duration: chunk.duration ?? 0,
        dts,
        cts: dts,
        is_sync: chunk.type === 'key'
      }
    )
  })

  return {
    stop: async () => {
      await encoder.flush()
      encoder.close()
    },
    encoder
  }
}

function createVideoEncoder (
  opts: IWorkerOpts,
  outHandler: EncodedVideoChunkOutputCallback
): VideoEncoder {
  const encoder = new VideoEncoder({
    error: console.error,
    output: outHandler
  })

  const videoOpts = opts.video
  encoder.configure({
    codec: 'avc1.42E01F',
    framerate: videoOpts.expectFPS,
    hardwareAcceleration: 'prefer-hardware',
    // 码率
    bitrate: opts.bitrate,
    width: videoOpts.width,
    height: videoOpts.height,
    // H264 不支持背景透明度
    alpha: 'discard',
    // macos 自带播放器只支持avc
    avc: { format: 'avc' }
    // mp4box.js 无法解析 annexb 的 mimeCodec ，只会显示 avc1
    // avc: { format: 'annexb' }
  })
  return encoder
}

function convertFile2Stream (
  file: MP4File,
  timeSlice: number,
  onCancel: TCleanFn
): {
    stream: ReadableStream<ArrayBuffer>
    stop: TCleanFn
  } {
  let timerId = 0

  let sendedBoxIdx = 0
  const boxes = file.boxes
  const deltaBuf = (): ArrayBuffer => {
    const ds = new mp4box.DataStream()
    ds.endianness = mp4box.DataStream.BIG_ENDIAN
    for (let i = sendedBoxIdx; i < boxes.length; i++) {
      boxes[i].write(ds)
    }
    sendedBoxIdx = boxes.length
    return ds.buffer
  }

  let stoped = false
  let exit: (TCleanFn) | null = null
  const stream = new ReadableStream({
    start (ctrl) {
      timerId = self.setInterval(() => {
        ctrl.enqueue(deltaBuf())
      }, timeSlice)

      exit = () => {
        clearInterval(timerId)
        file.flush()
        ctrl.enqueue(deltaBuf())
        ctrl.close()
      }

      // 安全起见，检测如果start触发时已经 stoped
      if (stoped) exit()
    },
    cancel () {
      clearInterval(timerId)
      onCancel()
    }
  })

  return {
    stream,
    stop: () => {
      stoped = true
      exit?.()
    }
  }
}
