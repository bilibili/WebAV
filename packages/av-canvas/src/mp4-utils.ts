import mp4box, { MP4ArrayBuffer, MP4File, MP4Info, MP4Sample, MP4VideoTrack } from 'mp4box'
import { parseVideoCodecDesc } from './utils'

type TCleanFn = () => void

// demuxcode(stream {})
// remuxcode
// stream2file
// file2stream

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

export function demuxcode (
  stream: ReadableStream<Uint8Array>,
  cbs: {
    onReady: (info: MP4Info) => void
    onVideoOutput: (vf: VideoFrame) => void
    onAudioOutput: (ad: AudioData) => void
    onEnded: () => void
  }
): {
    seek: (time: number) => void
  } {
  const mp4File = mp4box.createFile()
  const vd = new VideoDecoder({
    output: (vf) => {
      cbs.onVideoOutput(vf)
      resetTimer()
    },
    error: console.error
  })
  let endedTimer = 0
  function resetTimer (): void {
    clearTimeout(endedTimer)
    endedTimer = self.setTimeout(() => {
      if (vd.decodeQueueSize === 0) {
        cbs.onEnded()
      } else {
        resetTimer()
      }
      // todo: warn, mabye not close emited frame
    }, 300)
  }

  let mp4Info: MP4Info | null = null
  let vTrackInfo: MP4VideoTrack | null = null
  mp4File.onReady = (info) => {
    mp4Info = info
    vTrackInfo = info.videoTracks[0]
    if (vTrackInfo != null) {
      const vTrack = mp4File.getTrackById(vTrackInfo.id)
      // Generate and emit an appropriate VideoDecoderConfig.
      const vdConf = {
        codec: vTrackInfo.codec,
        codedHeight: vTrackInfo.video.height,
        codedWidth: vTrackInfo.video.width,
        description: parseVideoCodecDesc(vTrack)
      }
      vd.configure(vdConf)
      mp4File.setExtractionOptions(vTrackInfo.id, 'video')
      mp4File.start()
    }
  }

  let totalVideoSamples: MP4Sample[] = []
  let duration = 0
  let timerId = 0
  mp4File.onSamples = (_, type, samples) => {
    if (type === 'video') {
      totalVideoSamples = totalVideoSamples.concat(samples)
    }

    clearTimeout(timerId)
    timerId = self.setTimeout(() => {
      // 单位  微秒
      duration = totalVideoSamples.reduce(
        (acc, cur) => acc + cur.duration,
        0
      )

      if (mp4Info != null) {
        // Fragment mp4 中 duration 为 0，所以需要统计samples 的 duration
        // 注意：所有 samples 的 duration 累加，与解码后的 VideoFrame 累加 值接近，但不相等
        mp4Info.duration = duration
        cbs.onReady(mp4Info)
      }
    }, 300)
  }

  const reader = stream.getReader()
  let chunkOffset = 0
  async function readFile (): Promise<void> {
    const { done, value } = await reader.read()
    if (done) {
      console.log('source read done')
      return
    }

    const chunk = value.buffer as MP4ArrayBuffer
    chunk.fileStart = chunkOffset
    chunkOffset += chunk.byteLength
    mp4File.appendBuffer(chunk)

    readFile().catch(console.error)
  }
  readFile().catch(console.error)

  return {
    seek: (time) => {
      // console.log(1111, videoSamples, vInfo)
      if (vTrackInfo == null) throw Error('Not ready')

      const targetTime = time * vTrackInfo.timescale
      const endIdx = totalVideoSamples.findIndex(s => s.cts >= targetTime)
      const targetSamp = totalVideoSamples[endIdx]

      if (targetSamp == null) throw Error('Not found frame')
      let startIdx = 0
      if (!targetSamp.is_sync) {
        startIdx = endIdx - 1
        while (true) {
          if (startIdx <= 0) break
          if (totalVideoSamples[startIdx].is_sync) break
          startIdx -= 1
        }
      }
      // samples 全部 推入解码器，解码器有维护队列
      const samples = totalVideoSamples.slice(startIdx)
      samples.forEach(s => {
      // videoSamples.forEach(s => {
        vd.decode(new EncodedVideoChunk({
          type: s.is_sync ? 'key' : 'delta',
          timestamp: 1e6 * s.cts / s.timescale,
          duration: 1e6 * s.duration / s.timescale,
          data: s.data
        }))
      })
    }
  }
}

export function recodemux (
  opts: IWorkerOpts,
  cbs: {
    onEnded: TCleanFn
  }
): {
    encodeVideo: VideoEncoder['encode']
    close: TCleanFn
    mp4file: MP4File
  } {
  const mp4file = mp4box.createFile()

  const encoder = encodeVideoTrack(opts, mp4file, () => {})

  encoder.ondequeue = () => {
    if (encoder.encodeQueueSize === 0) {
      cbs.onEnded()
    }
  }

  return {
    encodeVideo: encoder.encode.bind(encoder),
    close: () => {
      encoder.flush().catch(console.error)
      encoder.close()
    },
    mp4file
  }
}

export function encodeVideoTrack (
  opts: IWorkerOpts,
  mp4File: MP4File,
  onTrackReady: TCleanFn
): VideoEncoder {
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

  return encoder
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

export function convertFile2Stream (
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
