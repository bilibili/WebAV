import mp4box, { MP4File } from 'mp4box'
import { IEncoderConf } from './types'

enum State {
  Preparing = 'preparing',
  Running = 'running',
  Paused = 'paused',
  Stopped = 'stopped'
}

let STATE = State.Preparing
let encoder: VideoEncoder

self.onmessage = (evt: MessageEvent) => {
  const { type, data } = evt.data

  switch (type) {
    case 'start':
      if (STATE === State.Preparing) init(data)
      break
    // todo
    case 'pause':
    case 'stop':
      STATE = State.Stopped
      encoder.close()
      break
  }
}

function init (opts: IEncoderConf): void {
  STATE = State.Running

  const getImgTimerId = 0
  const outHandler = createOutHandler(opts)
  encoder = new VideoEncoder({
    error: (err) => {
      console.error('VideoEncoder error : ', err)
      clearInterval(getImgTimerId)
    },
    output: outHandler.handler
  })

  encoder.configure({
    codec: 'avc1.42E01F',
    framerate: opts.fps,
    hardwareAcceleration: 'prefer-hardware',
    // 码率
    bitrate: opts.bitrate ?? 3_000_000,
    width: opts.width,
    height: opts.height,
    alpha: 'discard',
    // macos 自带播放器只支持avc
    avc: { format: 'avc' }
    // mp4box.js 无法解析 annexb 的 mimeCodec ，只会显示 avc1
    // avc: { format: 'annexb' }
  })

  encodeFrame(encoder, opts.videoFrameStream)

  const stream = convertFile2Stream(outHandler.outputFile)
  self.postMessage({
    type: 'outputStream',
    data: stream
  }, [stream])
}

const createOutHandler: (opts: IEncoderConf) => {
  handler: EncodedVideoChunkOutputCallback
  outputFile: MP4File
} = (opts) => {
  const outputFile = mp4box.createFile()
  const timescale = 1_000_000
  const videoEncodingTrackOptions = {
    // 微秒
    timescale,
    width: opts.width,
    height: opts.height,
    brands: ['isom', 'iso2', 'avc1', 'mp41'],
    avcDecoderConfigRecord: null as AllowSharedBufferSource | undefined | null
  }

  let vTrackId: number

  return {
    outputFile,
    handler: (chunk, meta) => {
      if (vTrackId == null) {
        videoEncodingTrackOptions.avcDecoderConfigRecord = meta.decoderConfig?.description
        vTrackId = outputFile.addTrack(videoEncodingTrackOptions)
      }
      const buf = new ArrayBuffer(chunk.byteLength)
      chunk.copyTo(buf)
      const dts = chunk.timestamp

      outputFile.addSample(
        vTrackId,
        buf,
        {
          duration: chunk.duration ?? 0,
          dts,
          cts: dts,
          is_sync: chunk.type === 'key'
        }
      )
    }
  }
}

const encodeFrame = (
  encoder: VideoEncoder,
  stream: ReadableStream<VideoFrame>
): void => {
  let frameCount = 0
  const startTime = performance.now()
  let lastTime = startTime

  const reader = stream.getReader()

  run()
    .catch(console.error)

  async function run (): Promise<void> {
    const { done, value: srouceFrame } = await reader.read()
    if (done || encoder.state === 'closed') return
    if (srouceFrame == null) {
      await run()
      return
    }
    const now = performance.now()
    const timestamp = (now - startTime) * 1000
    const duration = (now - lastTime) * 1000
    // @ts-expect-error
    const vf = new VideoFrame(srouceFrame, {
      timestamp,
      duration
    })
    lastTime = now

    // todo：关键帧间隔可配置
    encoder.encode(vf, { keyFrame: frameCount % 150 === 0 })
    vf.close()
    srouceFrame.close()
    frameCount += 1

    await run()
  }
}

function convertFile2Stream (file: MP4File): ReadableStream<ArrayBuffer> {
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
  return new ReadableStream({
    start (ctrl) {
      timerId = self.setInterval(() => {
        if (STATE === State.Stopped) {
          clearInterval(timerId)
          file.flush()
          ctrl.enqueue(deltaBuf())
          ctrl.close()
        } else {
          ctrl.enqueue(deltaBuf())
        }
      }, 500)
    },
    cancel () {
      clearInterval(timerId)
    }
  })
}
