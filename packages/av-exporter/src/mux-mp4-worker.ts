import mp4box, { MP4File } from 'mp4box'
import { IEncoderConf } from './types'

enum State {
  Preparing = 'preparing',
  Running = 'running',
  Stopped = 'stopped'
}

let STATE = State.Preparing

let clear: (() => void) | null = null
self.onmessage = (evt: MessageEvent) => {
  const { type, data } = evt.data

  switch (type) {
    case 'start':
      if (STATE === State.Preparing) {
        STATE = State.Running
        clear = init(data, () => {
          STATE = State.Stopped
        })
      }
      break
    case 'stop':
      STATE = State.Stopped
      clear?.()
      break
  }
}

function init (
  opts: IEncoderConf,
  onEnded: () => void
): () => void {
  const outHandler = createOutHandler(opts)
  const encoder = new VideoEncoder({
    error: (err) => {
      console.error('VideoEncoder error : ', err)
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

  const stopEncode = encodeFrame(
    encoder,
    opts.videoFrameStream,
    onEnded
  )

  const { stream, stop: stopStream } = convertFile2Stream(
    outHandler.outputFile,
    onEnded
  )
  self.postMessage({
    type: 'outputStream',
    data: stream
  }, [stream])

  return () => {
    stopEncode()
    stopStream()
    encoder.close()
  }
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
  stream: ReadableStream<VideoFrame>,
  onEnded: () => void
): () => void => {
  let frameCount = 0
  const startTime = performance.now()
  let lastTime = startTime

  const reader = stream.getReader()

  let stoped = false
  async function run (): Promise<void> {
    const { done, value: srouceFrame } = await reader.read()
    if (done) {
      onEnded()
      return
    }

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

    if (stoped) {
      srouceFrame.close()
      vf.close()
      return
    }

    encoder.encode(vf, { keyFrame: frameCount % 150 === 0 })
    vf.close()
    srouceFrame.close()
    frameCount += 1

    await run()
  }

  run().catch(console.error)

  return () => {
    stoped = true
  }
}

function convertFile2Stream (
  file: MP4File,
  onCancel: () => void
): {
    stream: ReadableStream<ArrayBuffer>
    stop: () => void
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
  let exit: (() => void) | null = null
  const stream = new ReadableStream({
    start (ctrl) {
      timerId = self.setInterval(() => {
        ctrl.enqueue(deltaBuf())
      }, 500)

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
