import mp4box, { MP4ArrayBuffer, MP4AudioTrack, MP4File, MP4Info, MP4Sample, MP4VideoTrack } from 'mp4box'
import { parseVideoCodecDesc } from './utils'

type TCleanFn = () => void

interface IWorkerOpts {
  video: {
    width: number
    height: number
    expectFPS: number
  }
  audio: {
    codec: 'opus' | 'aac'
    sampleRate: number
    sampleSize: number
    channelCount: number
  }
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
  const mp4File = stream2file(stream)

  const resetEndTimer = debounce(() => {
    if (vdecoder.decodeQueueSize === 0) {
      cbs.onEnded()
    } else {
      resetEndTimer()
    }
    // todo: warn, mabye not close emited frame
  }, 300)

  const vdecoder = new VideoDecoder({
    output: (vf) => {
      cbs.onVideoOutput(vf)
      resetEndTimer()
    },
    error: console.error
  })
  const adecoder = new AudioDecoder({
    output: (audioData) => {
      cbs.onAudioOutput(audioData)
      resetEndTimer()
    },
    error: console.error
  })

  let mp4Info: MP4Info | null = null
  let vTrackInfo: MP4VideoTrack | null = null
  let aTrackInfo: MP4AudioTrack | null = null
  mp4File.onReady = (info) => {
    console.log(5555, info)
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
      vdecoder.configure(vdConf)
      mp4File.setExtractionOptions(vTrackInfo.id, 'video')
    }

    aTrackInfo = info.audioTracks[0]
    if (aTrackInfo != null) {
      const adConf = {
        // description: trak.mdia.minf.stbl.stsd.entries[0].esds.esd.descs[0].descs[0].data;
        codec: aTrackInfo.codec === 'mp4a' ? 'mp4a.40.2' : aTrackInfo.codec,
        numberOfChannels: aTrackInfo.audio.channel_count,
        sampleRate: aTrackInfo.audio.sample_rate
      }
      adecoder.configure(adConf)
      mp4File.setExtractionOptions(aTrackInfo.id, 'audio')
    }
    mp4File.start()
  }

  let totalVideoSamples: MP4Sample[] = []
  let totalAudioSamples: MP4Sample[] = []
  const resetReady = debounce(() => {
    if (mp4Info != null) {
      // Fragment mp4 中 duration 为 0，所以需要统计samples 的 duration
      // 注意：所有 samples 的 duration 累加，与解码后的 VideoFrame 累加 值接近，但不相等
      mp4Info.duration = totalVideoSamples.reduce(
        (acc, cur) => acc + cur.duration, 0
      )
      cbs.onReady(mp4Info)
    }
  }, 300)

  mp4File.onSamples = (_, type, samples) => {
    if (type === 'video') {
      totalVideoSamples = totalVideoSamples.concat(samples)
    } else if (type === 'audio') {
      totalAudioSamples = totalAudioSamples.concat(samples)
    }
    resetReady()
  }

  return {
    seek: (time) => {
      if (vTrackInfo != null) {
        const startIdx = findStartSampleIdx(
          totalVideoSamples,
          time * vTrackInfo.timescale
        )
        // samples 全部 推入解码器，解码器有维护队列
        const samples = totalVideoSamples.slice(startIdx)
        samples.forEach(s => {
          vdecoder.decode(new EncodedVideoChunk({
            type: s.is_sync ? 'key' : 'delta',
            timestamp: 1e6 * s.cts / s.timescale,
            duration: 1e6 * s.duration / s.timescale,
            data: s.data
          }))
        })
      }
      if (aTrackInfo != null) {
        const startIdx = findStartSampleIdx(
          totalAudioSamples,
          time * aTrackInfo.timescale
        )
        // samples 全部 推入解码器，解码器有维护队列
        const samples = totalAudioSamples.slice(startIdx)
        samples.forEach(s => adecoder.decode(new EncodedAudioChunk({
          type: s.is_sync ? 'key' : 'delta',
          timestamp: 1e6 * s.cts / s.timescale,
          duration: 1e6 * s.duration / s.timescale,
          data: s.data
        })))
      }
    }
  }
}

/**
 * 找到最近的 关键帧 索引
 */
function findStartSampleIdx (samples: MP4Sample[], time: number): number {
  const endIdx = samples.findIndex(s => s.cts >= time)
  const targetSamp = samples[endIdx]

  if (targetSamp == null) throw Error('Not found frame')
  let startIdx = 0
  if (!targetSamp.is_sync) {
    startIdx = endIdx - 1
    while (true) {
      if (startIdx <= 0) break
      if (samples[startIdx].is_sync) break
      startIdx -= 1
    }
  }
  return startIdx
}

export function recodemux (
  opts: IWorkerOpts,
  cbs: {
    onEnded: TCleanFn
  }
): {
    encodeVideo: (
      frame: VideoFrame,
      options?: VideoEncoderEncodeOptions
    ) => void
    encodeAudio: (data: AudioData) => void
    close: TCleanFn
    mp4file: MP4File
  } {
  const mp4file = mp4box.createFile()

  let aEncoder: AudioEncoder | null = null
  const vEncoder = encodeVideoTrack(opts, mp4file, () => {
    // todo: 提上去
    aEncoder = encodeAudioTrack(opts.audio, mp4file)
  })

  vEncoder.ondequeue = () => {
    if (vEncoder.encodeQueueSize === 0) {
      cbs.onEnded()
    }
  }

  return {
    encodeVideo: vEncoder.encode.bind(vEncoder),
    encodeAudio: (ad) => {
      if (aEncoder == null) {
        console.log(1111, ad)
      }
      aEncoder?.encode(ad)
    },
    close: () => {
      vEncoder.flush().catch(console.error)
      vEncoder.close()
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
    brands: ['isom', 'iso2', 'avc1', 'mp42'],
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

function encodeAudioTrack (
  audioOpts: NonNullable<IWorkerOpts['audio']>,
  mp4File: MP4File
): AudioEncoder {
  const audioTrackOpts = {
    timescale: 1e6,
    samplerate: audioOpts.sampleRate,
    channel_count: audioOpts.channelCount,
    samplesize: audioOpts.sampleSize,
    // width: 0,
    // height: 0,
    // duration: 0,
    // nb_samples: 0,
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

  return encoder
}

function stream2file (stream: ReadableStream<Uint8Array>): MP4File {
  const reader = stream.getReader()
  let chunkOffset = 0
  const file = mp4box.createFile()
  async function readFile (): Promise<void> {
    while (true) {
      const { done, value } = await reader.read()
      if (done) {
        console.log('source read done')
        return
      }

      const chunk = value.buffer as MP4ArrayBuffer
      chunk.fileStart = chunkOffset
      chunkOffset += chunk.byteLength
      file.appendBuffer(chunk)
    }
  }
  readFile().catch(console.error)

  return file
}

export function file2stream (
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

export function debounce <F extends (...args: any[]) => any> (
  func: F,
  wait: number
): (...rest: Parameters<F>) => void {
  let timer = 0

  return function (this: any, ...rest) {
    self.clearTimeout(timer)
    timer = self.setTimeout(() => {
      func.apply(this, rest)
    }, wait)
  }
}
