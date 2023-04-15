import mp4box, { MP4File } from 'mp4box'
import { IRecorderConf, TAsyncClearFn, TClearFn, IStream, EWorkerMsg } from './types'

type TWorkerOpts = Required<IRecorderConf> & {
  streams: IStream
  timeSlice: number
}

enum State {
  Preparing = 'preparing',
  Running = 'running',
  Stopped = 'stopped'
}

let STATE = State.Preparing

let clear: TAsyncClearFn | null = null
self.onmessage = async (evt: MessageEvent) => {
  const { type, data } = evt.data

  switch (type) {
    case EWorkerMsg.Start:
      if (STATE === State.Preparing) {
        STATE = State.Running
        clear = init(data, () => {
          STATE = State.Stopped
        })
      }
      break
    case EWorkerMsg.Stop:
      STATE = State.Stopped
      await clear?.()
      self.postMessage({ type: EWorkerMsg.SafeExit })
      break
  }
}

function init (
  opts: TWorkerOpts,
  onEnded: TClearFn
): TAsyncClearFn {
  const mp4File = mp4box.createFile()
  let stopEncodeVideo: TAsyncClearFn | null = null
  if (opts.streams.video != null) {
    stopEncodeVideo = encodeVideoTrack(opts, mp4File, onEnded)
  }
  let stopEncodeAudio: TAsyncClearFn | null = null
  if (opts.streams.audio != null) {
    stopEncodeAudio = encodeAudioTrack(opts, mp4File, onEnded)
  }

  const { stream, stop: stopStream } = convertFile2Stream(
    mp4File,
    opts.timeSlice,
    onEnded
  )
  self.postMessage({
    type: EWorkerMsg.OutputStream,
    data: stream
  }, [stream])

  return async () => {
    await stopEncodeVideo?.()
    await stopEncodeAudio?.()
    stopStream()
  }
}

function encodeVideoTrack (
  opts: TWorkerOpts,
  mp4File: MP4File,
  onEnded: TClearFn
): TAsyncClearFn {
  const videoTrackOpts = {
    // 微秒
    timescale: 1e6,
    width: opts.width,
    height: opts.height,
    brands: ['isom', 'iso2', 'avc1', 'mp41'],
    avcDecoderConfigRecord: null as AllowSharedBufferSource | undefined | null
  }

  let vTrackId: number
  const encoder = createVideoEncoder(opts, (chunk, meta) => {
    if (vTrackId == null) {
      videoTrackOpts.avcDecoderConfigRecord = meta.decoderConfig?.description
      vTrackId = mp4File.addTrack(videoTrackOpts)
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

  const stopEncode = encodeVideoFrame(
    encoder,
    opts.fps,
    opts.streams.video as ReadableStream,
    onEnded
  )

  return async () => {
    stopEncode()
    await encoder.flush()
    encoder.close()
  }
}

function createVideoEncoder (
  opts: TWorkerOpts,
  outHandler: EncodedVideoChunkOutputCallback
): VideoEncoder {
  const encoder = new VideoEncoder({
    error: console.error,
    output: outHandler
  })

  encoder.configure({
    codec: 'avc1.42E01F',
    framerate: opts.fps,
    hardwareAcceleration: 'prefer-hardware',
    // 码率
    bitrate: opts.bitrate,
    width: opts.width,
    height: opts.height,
    // H264 不支持背景透明度
    alpha: 'discard',
    // macos 自带播放器只支持avc
    avc: { format: 'avc' }
    // mp4box.js 无法解析 annexb 的 mimeCodec ，只会显示 avc1
    // avc: { format: 'annexb' }
  })
  return encoder
}

function encodeVideoFrame (
  encoder: VideoEncoder,
  expectFPS: number,
  stream: ReadableStream<VideoFrame>,
  onEnded: TClearFn
): TClearFn {
  let frameCount = 0
  const startTime = performance.now()
  let lastTime = startTime

  const reader = stream.getReader()

  const maxFPS = expectFPS * 1.1
  let stoped = false
  let frameCnt = 0
  async function run (): Promise<void> {
    while (true) {
      const { done, value: frame } = await reader.read()
      if (done) {
        onEnded()
        return
      }
      if (frame == null) continue
      if (stoped) {
        frame.close()
        return
      }

      const now = performance.now()
      const offsetTime = now - startTime
      // 避免帧率超出期望太高
      if (frameCnt / offsetTime * 1000 > maxFPS) continue

      // @ts-expect-error
      const vf = new VideoFrame(frame, {
        // timestamp 单位 微妙
        timestamp: offsetTime * 1000,
        duration: (now - lastTime) * 1000
      })
      lastTime = now

      encoder.encode(vf, { keyFrame: frameCount % 150 === 0 })
      frameCnt += 1
      vf.close()
      frame.close()
      frameCount += 1
    }
  }

  run().catch(console.error)

  return () => {
    stoped = true
  }
}

function encodeAudioTrack (
  opts: TWorkerOpts,
  mp4File: MP4File,
  onEnded: TClearFn
): TAsyncClearFn {
  const sampleRate = 48000
  const audioTrackOpts = {
    timescale: 1e6,
    media_duration: 0,
    duration: 0,
    nb_samples: 0,
    samplerate: sampleRate,
    channel_count: 2,
    width: 0,
    height: 0,
    hdlr: 'soun',
    name: 'SoundHandler',
    // type: 'mp4a'
    type: opts.audioCodec === 'aac' ? 'mp4a' : 'Opus'
  }

  let trackId: number | null = null
  const encoder = createAudioEncoder(opts, (chunk) => {
    if (trackId == null) {
      trackId = mp4File.addTrack(audioTrackOpts)
    }
    const buf = new ArrayBuffer(chunk.byteLength)
    chunk.copyTo(buf)
    const dts = chunk.timestamp
    mp4File.addSample(trackId, buf, {
      duration: chunk.duration ?? 0,
      dts,
      cts: dts,
      is_sync: chunk.type === 'key'
    })
  })

  const stopEncode = encodeAudioData(
    encoder,
    opts.streams.audio as ReadableStream<AudioData>,
    onEnded
  )

  return async () => {
    stopEncode()
    await encoder.flush()
    encoder.close()
  }
}

function createAudioEncoder (
  opts: TWorkerOpts,
  outHandler: EncodedAudioChunkOutputCallback
): AudioEncoder {
  const audioEncoder = new AudioEncoder({
    error: console.error,
    output: outHandler
  })
  audioEncoder.configure({
    codec: opts.audioCodec === 'aac' ? 'mp4a.40.2' : 'opus',
    sampleRate: 48000,
    numberOfChannels: 2,
    bitrate: 128_000
  })
  return audioEncoder
}

function encodeAudioData (
  encoder: AudioEncoder,
  stream: ReadableStream<AudioData>,
  onEnded: TClearFn
): TClearFn {
  const reader = stream.getReader()
  let stoped = false

  async function run (): Promise<void> {
    while (true) {
      const { done, value: audioData } = await reader.read()
      if (done) {
        onEnded()
        return
      }

      if (audioData == null) continue

      if (stoped) {
        audioData.close()
        return
      }

      encoder.encode(audioData)
      audioData.close()

      // reset audioData.timestamp
      // const now = performance.now()
      // const timestamp = (now - startTime) * 1000

      // const bufs = []
      // for (let i = 0; i < audioData.numberOfChannels; i += 1) {
      //   const ab = new ArrayBuffer(audioData.allocationSize({
      //     planeIndex: i
      //   }))
      //   audioData.copyTo(ab, { planeIndex: i })
      //   bufs.push(ab)
      // }

      // const ad = new AudioData({
      //   timestamp,
      //   data: bufs.reduce(concatArrBuf),
      //   format: audioData.format,
      //   sampleRate: 48000,
      //   numberOfFrames: audioData.numberOfFrames,
      //   numberOfChannels: audioData.numberOfChannels
      // })
      // console.log(3333, ad.timestamp, ad.duration)

      // encoder.encode(ad)
      // audioData.close()
      // ad.close()

      // function concatArrBuf (buf1: ArrayBuffer, buf2: ArrayBuffer): ArrayBuffer {
      //   const tmp = new Uint8Array(buf1.byteLength + buf2.byteLength)
      //   tmp.set(new Uint8Array(buf1), 0)
      //   tmp.set(new Uint8Array(buf2), buf1.byteLength)
      //   return tmp.buffer
      // }
    }
  }

  run().catch(console.error)
  return () => {
    stoped = true
  }
}

function convertFile2Stream (
  file: MP4File,
  timeSlice: number,
  onCancel: TClearFn
): {
    stream: ReadableStream<ArrayBuffer>
    stop: TClearFn
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
  let exit: (TClearFn) | null = null
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
