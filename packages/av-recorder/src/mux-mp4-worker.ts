import mp4box, { MP4File } from 'mp4box'
import { TAsyncClearFn, TClearFn, EWorkerMsg, IWorkerOpts } from './types'

if (import.meta.env.DEV) {
  mp4box.Log.setLogLevel(mp4box.Log.debug)
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
  opts: IWorkerOpts,
  onEnded: TClearFn
): TAsyncClearFn {
  const mp4File = mp4box.createFile()
  let stopEncodeVideo: TAsyncClearFn | null = null
  let stopEncodeAudio: TAsyncClearFn | null = null

  // video 必须先于 audio
  function onVideoTrackReady (): void {
    if (opts.streams.audio != null) {
      stopEncodeAudio = encodeAudioTrack(opts, mp4File, onEnded)
    }
  }

  if (opts.streams.video != null) {
    stopEncodeVideo = encodeVideoTrack(
      opts,
      mp4File,
      onVideoTrackReady,
      onEnded
    )
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
  opts: IWorkerOpts,
  mp4File: MP4File,
  onTrackReady: () => void,
  onEnded: TClearFn
): TAsyncClearFn {
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

  const stopEncode = encodeVideoFrame(
    encoder,
    opts.video.expectFPS,
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
  opts: IWorkerOpts,
  mp4File: MP4File,
  onEnded: TClearFn
): TAsyncClearFn {
  const audioOpts = opts.audio
  if (audioOpts == null) return async () => {}

  const audioTrackOpts = {
    timescale: 1e6,
    media_duration: 0,
    duration: 0,
    nb_samples: 0,
    samplerate: audioOpts.sampleRate,
    channel_count: audioOpts.channelCount,
    samplesize: audioOpts.sampleSize,
    width: 0,
    height: 0,
    hdlr: 'soun',
    name: 'SoundHandler',
    type: audioOpts.codec === 'aac' ? 'mp4a' : 'Opus'
  }

  const trackId = mp4File.addTrack(audioTrackOpts)
  const encoder = new AudioEncoder({
    error: console.error,
    output: (chunk) => {
      const buf = new ArrayBuffer(chunk.byteLength)
      chunk.copyTo(buf)
      const dts = chunk.timestamp
      mp4File.addSample(trackId, buf, {
        duration: chunk.duration ?? 0,
        dts,
        cts: dts,
        is_sync: chunk.type === 'key'
      })
    }
  })
  encoder.configure({
    codec: audioOpts.codec === 'aac' ? 'mp4a.40.2' : 'opus',
    sampleRate: audioOpts.sampleRate,
    numberOfChannels: audioOpts.channelCount,
    bitrate: 128_000
  })

  const stopEncode = encodeAudioData(encoder, opts, onEnded)

  return async () => {
    stopEncode()
    if (encoder.state === 'configured') await encoder.flush()
    encoder.close()
  }
}

function encodeAudioData (
  encoder: AudioEncoder,
  opts: IWorkerOpts,
  onEnded: TClearFn
): TClearFn {
  const reader = opts.streams.audio?.getReader() as ReadableStreamDefaultReader<AudioData>
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
