import mp4box, {
  MP4ArrayBuffer,
  MP4AudioTrack,
  MP4File,
  MP4Info,
  MP4Sample,
  MP4VideoTrack,
  SampleOpts,
  TrakBoxParser,
  VideoTrackOpts
} from 'mp4box'
import { Log } from './log'
import { AudioTrackOpts } from 'mp4box'
import {
  extractPCM4AudioData,
  mixPCM,
  ringSliceFloat32Array,
  sleep
} from './av-utils'
import { extractPCM4AudioBuffer } from './av-utils'

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
  opts: { audio: boolean; start: number; end: number },
  cbs: {
    onReady: (info: MP4Info) => void
    onVideoOutput: (vf: VideoFrame) => void
    onAudioOutput: (ad: AudioData) => void
    onComplete: () => void
  }
): {
  stop: () => void
  getDecodeQueueSize: () => {
    video: number
    audio: number
  }
} {
  let stopResetEndTimer = false
  const resetEndTimer = debounce(() => {
    if (stopResetEndTimer) return
    if (vdecoder.decodeQueueSize === 0 && adecoder.decodeQueueSize === 0) {
      cbs.onComplete()
    } else {
      resetEndTimer()
    }
  }, 300)

  const vdecoder = new VideoDecoder({
    output: vf => {
      cbs.onVideoOutput(vf)
      resetEndTimer()
    },
    error: Log.error
  })
  const adecoder = new AudioDecoder({
    output: audioData => {
      cbs.onAudioOutput(audioData)
      resetEndTimer()
    },
    error: Log.error
  })

  let mp4Info: MP4Info | null = null

  // todo: 大文件时需要流式加载
  // 第一个解码的 sample（EncodedVideoChunk） 必须是关键帧（is_sync）
  let firstDecodeVideo = true
  let lastVideoKeyChunkIdx = 0
  const { file: mp4File, stop: stopReadStream } = demuxMP4(stream, {
    onReady: (file, info) => {
      mp4Info = info
      const { videoDecoderConf, audioDecoderConf } = extractFileConfig(
        file,
        info
      )
      if (videoDecoderConf != null) vdecoder.configure(videoDecoderConf)
      if (opts.audio && audioDecoderConf != null)
        adecoder.configure(audioDecoderConf)

      cbs.onReady(info)
    },
    onSamples (_, type, samples) {
      for (let i = 0; i < samples.length; i += 1) {
        const s = samples[i]
        if (firstDecodeVideo && s.is_sync) lastVideoKeyChunkIdx = i

        const cts = (1e6 * s.cts) / s.timescale
        if (cts >= opts.start && cts <= opts.end) {
          if (type === 'video') {
            if (firstDecodeVideo && !s.is_sync) {
              // 首次解码需要从 key chunk 开始
              firstDecodeVideo = false
              for (let j = lastVideoKeyChunkIdx; j < i; j++) {
                vdecoder.decode(
                  new EncodedVideoChunk(mp4Sample2ChunkOpts(samples[j]))
                )
              }
            }
            vdecoder.decode(new EncodedVideoChunk(mp4Sample2ChunkOpts(s)))
          } else if (type === 'audio') {
            adecoder.decode(new EncodedAudioChunk(mp4Sample2ChunkOpts(s)))
          }
        }
      }
    },
    onEnded: () => {
      if (mp4Info == null) throw Error('MP4 demux unready')
    }
  })

  return {
    stop: () => {
      stopResetEndTimer = true
      mp4File.stop()
      if (vdecoder.state !== 'closed') vdecoder.close()
      if (adecoder.state !== 'closed') adecoder.close()
      stopReadStream()
      stream.cancel()
    },
    getDecodeQueueSize: () => ({
      video: vdecoder.decodeQueueSize,
      audio: adecoder.decodeQueueSize
    })
  }
}

export function recodemux (opts: IWorkerOpts): {
  encodeVideo: (frame: VideoFrame, options?: VideoEncoderEncodeOptions) => void
  encodeAudio: (data: AudioData) => void
  close: TCleanFn
  mp4file: MP4File
  progress: number
  onEnded?: TCleanFn
} {
  const mp4file = mp4box.createFile()

  let aEncoder: AudioEncoder | null = null
  let audioDataCache: AudioData[] = []
  const vEncoder = encodeVideoTrack(opts, mp4file, () => {
    // 音视频轨道必须同时创建, 保存在 moov 中
    // 创建视频轨道需要 encdoer output 的 meta 数据, 所以音频轨道需要等待视频轨道
    aEncoder = encodeAudioTrack(opts.audio, mp4file)
    audioDataCache.forEach(ad => {
      aEncoder?.encode(ad)
      ad.close()
    })
    audioDataCache = []
  })

  let maxSize = 0
  let endCheckTimer = 0
  let started = false
  function checkEnded () {
    if (started) return
    started = true
    endCheckTimer = setInterval(() => {
      rs.progress = 1 - vEncoder.encodeQueueSize / maxSize
      if (vEncoder.encodeQueueSize === 0) {
        clearInterval(endCheckTimer)
        rs.onEnded?.()
      }
    }, 100)
  }

  const rs: ReturnType<typeof recodemux> = {
    encodeVideo: (vf, opts) => {
      vEncoder.encode(vf, opts)
      vf.close()

      if (vEncoder.encodeQueueSize > maxSize) maxSize = vEncoder.encodeQueueSize
      checkEnded()
    },
    encodeAudio: ad => {
      if (aEncoder == null) {
        audioDataCache.push(ad)
      } else {
        aEncoder.encode(ad)
        ad.close()
        checkEnded()
      }
    },
    close: () => {
      clearInterval(endCheckTimer)
      vEncoder.flush().catch(Log.error)
      vEncoder.close()
      aEncoder?.flush().catch(Log.error)
      aEncoder?.close()
    },
    mp4file,
    progress: 0
  }

  return rs
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
    brands: ['isom', 'iso2', 'avc1', 'mp42', 'mp41'],
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
    const s = chunk2MP4SampleOpts(chunk)
    mp4File.addSample(vTrackId, s.data, s)
  })

  return encoder
}

function createVideoEncoder (
  opts: IWorkerOpts,
  outHandler: EncodedVideoChunkOutputCallback
): VideoEncoder {
  const encoder = new VideoEncoder({
    error: Log.error,
    output: outHandler
  })

  const videoOpts = opts.video
  encoder.configure({
    codec: 'avc1.42E01F',
    framerate: videoOpts.expectFPS,
    // hardwareAcceleration: 'prefer-hardware',
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
    hdlr: 'soun',
    name: 'SoundHandler',
    type: audioOpts.codec === 'aac' ? 'mp4a' : 'Opus'
  }

  const trackId = mp4File.addTrack(audioTrackOpts)
  const encoder = new AudioEncoder({
    error: Log.error,
    output: chunk => {
      const s = chunk2MP4SampleOpts(chunk)
      mp4File.addSample(trackId, s.data, s)
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

export function stream2file (stream: ReadableStream<Uint8Array>): {
  file: MP4File
  stop: () => void
} {
  const reader = stream.getReader()
  let chunkOffset = 0
  const file = mp4box.createFile()
  let stoped = false
  async function readFile (): Promise<void> {
    while (!stoped) {
      const { done, value } = await reader.read()
      if (done) {
        Log.info('stream source read done')
        file.flush()
        file.onFlush?.()
        return
      }

      const chunk = value.buffer as MP4ArrayBuffer
      chunk.fileStart = chunkOffset
      chunkOffset += chunk.byteLength
      file.appendBuffer(chunk)
    }
  }
  readFile().catch(Log.error)

  return {
    file,
    stop: () => {
      stoped = true
      reader.releaseLock()
    }
  }
}

export function file2stream (
  file: MP4File,
  timeSlice: number,
  onCancel?: TCleanFn
): {
  stream: ReadableStream<Uint8Array>
  stop: TCleanFn
} {
  let timerId = 0

  let sendedBoxIdx = 0
  const boxes = file.boxes
  const deltaBuf = (): Uint8Array | null => {
    const ds = new mp4box.DataStream()
    ds.endianness = mp4box.DataStream.BIG_ENDIAN
    if (sendedBoxIdx >= boxes.length) return null
    for (let i = sendedBoxIdx; i < boxes.length; i++) {
      boxes[i].write(ds)
    }
    sendedBoxIdx = boxes.length
    return new Uint8Array(ds.buffer)
  }

  let stoped = false
  let exit: TCleanFn | null = null
  const stream = new ReadableStream({
    start (ctrl) {
      timerId = self.setInterval(() => {
        const d = deltaBuf()
        if (d != null) ctrl.enqueue(d)
      }, timeSlice)

      exit = () => {
        clearInterval(timerId)
        file.flush()
        const d = deltaBuf()
        if (d != null) ctrl.enqueue(d)
        ctrl.close()
      }

      // 安全起见，检测如果start触发时已经 stoped
      if (stoped) exit()
    },
    cancel () {
      clearInterval(timerId)
      onCancel?.()
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

export function debounce<F extends (...args: any[]) => any>(
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

// track is H.264, H.265 or VPX.
export function parseVideoCodecDesc (track: TrakBoxParser): Uint8Array {
  for (const entry of track.mdia.minf.stbl.stsd.entries) {
    // @ts-expect-error
    const box = entry.avcC ?? entry.hvcC ?? entry.vpcC
    if (box != null) {
      const stream = new mp4box.DataStream(
        undefined,
        0,
        mp4box.DataStream.BIG_ENDIAN
      )
      box.write(stream)
      return new Uint8Array(stream.buffer.slice(8)) // Remove the box header.
    }
  }
  throw Error('avcC, hvcC or VPX not found')
}

/**
 * EncodedAudioChunk | EncodedVideoChunk 转换为 MP4 addSample 需要的参数
 */
function chunk2MP4SampleOpts (
  chunk: EncodedAudioChunk | EncodedVideoChunk
): SampleOpts & {
  data: ArrayBuffer
} {
  const buf = new ArrayBuffer(chunk.byteLength)
  chunk.copyTo(buf)
  const dts = chunk.timestamp
  return {
    duration: chunk.duration ?? 0,
    dts,
    cts: dts,
    is_sync: chunk.type === 'key',
    data: buf
  }
}

function demuxMP4 (
  stream: ReadableStream,
  cbs: {
    onReady: (file: MP4File, info: MP4Info) => void | Promise<void>
    onEnded?: () => void
    onSamples: (
      id: number,
      type: 'video' | 'audio',
      samples: MP4Sample[]
    ) => void
  }
) {
  const { file, stop } = stream2file(stream)

  file.onSamples = (id, type, samples) => {
    cbs.onSamples(id, type, samples)
    file.releaseUsedSamples(id, samples.length)
  }

  file.onReady = async info => {
    await cbs.onReady(file, info)

    const vTrackId = info.videoTracks[0]?.id
    if (vTrackId != null) file.setExtractionOptions(vTrackId, 'video')

    const aTrackId = info.audioTracks[0]?.id
    if (aTrackId != null) file.setExtractionOptions(aTrackId, 'audio')

    file.start()
  }

  file.onFlush = cbs.onEnded

  return { file, stop }
}

function extractFileConfig (file: MP4File, info: MP4Info) {
  const vTrack = info.videoTracks[0]
  const rs: {
    videoTrackConf?: VideoTrackOpts
    videoDecoderConf?: Parameters<VideoDecoder['configure']>[0]
    audioTrackConf?: AudioTrackOpts
    audioDecoderConf?: Parameters<AudioDecoder['configure']>[0]
  } = {}
  if (vTrack != null) {
    const videoDesc = parseVideoCodecDesc(file.getTrackById(vTrack.id)).buffer
    const { descKey, type } = vTrack.codec.startsWith('avc1')
      ? { descKey: 'avcDecoderConfigRecord', type: 'avc1' }
      : vTrack.codec.startsWith('hvc1')
      ? { descKey: 'hevcDecoderConfigRecord', type: 'hvc1' }
      : { descKey: '', type: '' }
    if (descKey !== '') {
      rs.videoTrackConf = {
        timescale: vTrack.timescale,
        duration: vTrack.duration,
        width: vTrack.video.width,
        height: vTrack.video.height,
        brands: info.brands,
        type,
        [descKey]: videoDesc
      }
    }

    rs.videoDecoderConf = {
      codec: vTrack.codec,
      codedHeight: vTrack.video.height,
      codedWidth: vTrack.video.width,
      description: videoDesc
    }
  }

  const aTrack = info.audioTracks[0]
  if (aTrack != null) {
    rs.audioTrackConf = {
      timescale: aTrack.timescale,
      samplerate: aTrack.audio.sample_rate,
      channel_count: aTrack.audio.channel_count,
      samplesize: aTrack.audio.sample_size,
      hdlr: 'soun',
      name: 'SoundHandler',
      type: aTrack.codec
    }
    rs.audioDecoderConf = {
      codec: aTrack.codec === 'mp4a' ? 'mp4a.40.2' : aTrack.codec,
      numberOfChannels: aTrack.audio.channel_count,
      sampleRate: aTrack.audio.sample_rate
    }
  }
  return rs
}

/**
 * 快速顺序合并多个mp4流，要求所有mp4的属性是一致的
 * 属性包括（不限于）：音视频编码格式、分辨率、采样率
 */
export function fastConcatMP4 (streams: ReadableStream<Uint8Array>[]) {
  const outfile = mp4box.createFile()
  const { stream, stop: stopOutStream } = file2stream(outfile, 500, () => {})

  async function run () {
    let vTrackId = 0
    let vDTS = 0
    let vCTS = 0
    let aTrackId = 0
    let aDTS = 0
    let aCTS = 0
    // ts bug, 不能正确识别类型
    let lastVSamp: any = null
    let lastASamp: any = null
    for (const stream of streams) {
      await new Promise<void>(async resolve => {
        demuxMP4(stream, {
          onReady: (file, info) => {
            const { videoTrackConf, audioTrackConf } = extractFileConfig(
              file,
              info
            )
            if (vTrackId === 0 && videoTrackConf != null) {
              vTrackId = outfile.addTrack(videoTrackConf)
            }
            if (aTrackId === 0 && audioTrackConf != null) {
              aTrackId = outfile.addTrack(audioTrackConf)
            }
          },
          onSamples: (_, type, samples) => {
            const id = type === 'video' ? vTrackId : aTrackId
            const offsetDTS = type === 'video' ? vDTS : aDTS
            const offsetCTS = type === 'video' ? vCTS : aCTS
            samples.forEach(s => {
              outfile.addSample(id, s.data, {
                duration: s.duration,
                dts: s.dts + offsetDTS,
                cts: s.cts + offsetCTS,
                is_sync: s.is_sync
              })
            })

            const lastSamp = samples.at(-1)
            if (lastSamp == null) return
            if (type === 'video') {
              lastVSamp = lastSamp
            } else if (type === 'audio') {
              lastASamp = lastSamp
            }
          },
          onEnded: resolve
        })
      })
      if (lastVSamp != null) {
        vDTS = lastVSamp.dts
        vCTS = lastVSamp.cts
      }
      if (lastASamp != null) {
        aDTS = lastASamp.dts
        aCTS = lastASamp.cts
      }
    }

    stopOutStream()
  }

  run().catch(Log.error)

  return stream
}

function createMP4AudioSampleDecoder (
  adConf: Parameters<AudioDecoder['configure']>[0]
) {
  let lock = false

  let cacheAD: AudioData[] = []
  const adecoder = new AudioDecoder({
    output: ad => {
      cacheAD.push(ad)
    },
    error: Log.error
  })
  adecoder.configure(adConf)

  return async (ss: MP4Sample[]) => {
    while (lock || adecoder.decodeQueueSize > 0) {
      await sleep(1)
    }
    lock = true

    ss.forEach(s => {
      adecoder.decode(
        new EncodedAudioChunk({
          type: s.is_sync ? 'key' : 'delta',
          timestamp: (1e6 * s.cts) / s.timescale,
          duration: (1e6 * s.duration) / s.timescale,
          data: s.data
        })
      )
    })

    while (adecoder.decodeQueueSize > 0) {
      await sleep(1)
    }
    const rs = cacheAD
    cacheAD = []
    lock = false

    return rs
  }
}

function createMP4AudioSampleEncoder (
  aeConf: Parameters<AudioEncoder['configure']>[0]
) {
  let lock = false

  let cacheChunk: EncodedAudioChunk[] = []
  const adEncoder = new AudioEncoder({
    output: chunk => {
      cacheChunk.push(chunk)
    },
    error: Log.error
  })

  adEncoder.configure({
    codec: aeConf.codec,
    sampleRate: aeConf.sampleRate,
    numberOfChannels: aeConf.numberOfChannels
  })
  return async (
    data: Float32Array,
    ts: number
  ): Promise<ReturnType<typeof chunk2MP4SampleOpts>[]> => {
    while (lock || adEncoder.encodeQueueSize > 0) {
      await sleep(1)
    }
    lock = true

    adEncoder.encode(
      new AudioData({
        timestamp: ts,
        numberOfChannels: aeConf.numberOfChannels,
        numberOfFrames: data.length / aeConf.numberOfChannels,
        sampleRate: aeConf.sampleRate,
        format: 'f32-planar',
        data
      })
    )

    while (cacheChunk.length === 0 || adEncoder.encodeQueueSize > 0) {
      await sleep(1)
    }
    const rs = cacheChunk.map(chunk => chunk2MP4SampleOpts(chunk))
    cacheChunk = []
    lock = false

    return rs
  }
}

/**
 * 混合mp4与音频文件，仅重编码音频
 * @returns
 */
export function mixinMP4AndAudio (
  mp4Stream: ReadableStream<Uint8Array>,
  audio: {
    stream: ReadableStream<Uint8Array>
    volume: number
    loop: boolean
  }
) {
  const outfile = mp4box.createFile()
  const { stream: outStream, stop: stopOut } = file2stream(outfile, 500)
  const mixEnded = debounce(stopOut, 300)

  let audioSampleDecoder: ReturnType<
    typeof createMP4AudioSampleDecoder
  > | null = null

  let audioSampleEncoder: ReturnType<
    typeof createMP4AudioSampleEncoder
  > | null = null

  let inputAudioPCM: Float32Array[] = []

  let vTrackId = 0
  let aTrackId = 0
  let audioOffset = 0
  demuxMP4(mp4Stream, {
    onReady: async (file, info) => {
      const { videoTrackConf, audioTrackConf, audioDecoderConf } =
        extractFileConfig(file, info)
      if (vTrackId === 0 && videoTrackConf != null) {
        vTrackId = outfile.addTrack(videoTrackConf)
      }
      if (aTrackId === 0 && audioTrackConf != null) {
        aTrackId = outfile.addTrack(audioTrackConf)
        const audioCtx = new AudioContext({
          sampleRate: audioTrackConf.samplerate
        })
        inputAudioPCM = extractPCM4AudioBuffer(
          await audioCtx.decodeAudioData(
            await new Response(audio.stream).arrayBuffer()
          )
        )
      }

      if (audioDecoderConf == null) throw Error('mp4 not have audio track')
      audioSampleDecoder = createMP4AudioSampleDecoder(audioDecoderConf)
      audioSampleEncoder = createMP4AudioSampleEncoder(audioDecoderConf)
    },
    onSamples: async (id, type, samples) => {
      if (type === 'video') {
        samples.forEach(s => outfile.addSample(id, s.data, s))
        return
      }

      // todo: 处理 mp4 无音轨场景
      if (type !== 'audio') return
      if (audioSampleDecoder == null || audioSampleEncoder == null) {
        throw Error('Audio codec not created')
      }

      // 1. 先解码mp4音频
      const mixiedPCM = (await audioSampleDecoder(samples)).map(ad => {
        const mp4AudioBuf = extractPCM4AudioData(ad)
        // todo: 性能优化； 音频非循环，如果 inputAudioPCM 已消耗完则后续无需 重编码
        const inputAudioBuf = inputAudioPCM.map(chanBuf =>
          audio.loop
            ? ringSliceFloat32Array(
                chanBuf,
                audioOffset,
                audioOffset + mp4AudioBuf[0].length
              )
            : chanBuf.slice(audioOffset, audioOffset + mp4AudioBuf[0].length)
        )

        if (audio.volume !== 1) {
          for (const buf of inputAudioBuf)
            for (let i = 0; i < buf.length; i++) buf[i] *= audio.volume
        }

        audioOffset += mp4AudioBuf[0].length
        // 2. 混合输入的音频
        return {
          pcm: mixPCM([mp4AudioBuf, inputAudioBuf]),
          ts: ad.timestamp
        }
      })

      if (audioSampleEncoder == null) return
      mixiedPCM.forEach(async ({ pcm, ts }) => {
        // 3. 重编码音频
        ;(await audioSampleEncoder?.(pcm, ts))?.forEach(s => {
          // 4. 添加到 mp4 音轨
          outfile.addSample(aTrackId, s.data, s)
        })
        mixEnded()
      })
    }
  })

  return outStream
}

function mp4Sample2ChunkOpts (
  s: MP4Sample
): EncodedAudioChunkInit | EncodedVideoChunkInit {
  return {
    type: (s.is_sync ? 'key' : 'delta') as EncodedVideoChunkType,
    timestamp: (1e6 * s.cts) / s.timescale,
    duration: (1e6 * s.duration) / s.timescale,
    data: s.data
  }
}
