import mp4box, {
  MP4ArrayBuffer,
  MP4File,
  MP4Info,
  MP4Sample,
  SampleOpts,
  TrakBoxParser,
} from '@webav/mp4box.js'
import { Log } from '../log'
import {
  autoReadStream,
  extractPCM4AudioData,
  extractPCM4AudioBuffer,
  mixinPCM,
  ringSliceFloat32Array,
  concatPCMFragments
} from '../av-utils'
import { DEFAULT_AUDIO_CONF } from '../clips'
import { EventTool } from '../event-tool'
import { SampleTransform } from './sample-transform'
import { extractFileConfig, sample2ChunkOpts } from './mp4box-utils'

export { MP4Previewer } from './mp4-previewer'

type TCleanFn = () => void

interface IWorkerOpts {
  video: {
    width: number
    height: number
    expectFPS: number
    codec: string
  }
  audio: {
    codec: 'opus' | 'aac'
    sampleRate: number
    channelCount: number
  } | null
  bitrate: number
}

export function demuxcode(
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
} {
  const vdecoder = new VideoDecoder({
    output: vf => {
      cbs.onVideoOutput(vf)
    },
    error: Log.error
  })
  const adecoder = new AudioDecoder({
    output: audioData => {
      cbs.onAudioOutput(audioData)
    },
    error: Log.error
  })

  let mp4Info: MP4Info | null = null

  // 第一个解码的 sample（EncodedVideoChunk） 必须是关键帧（is_sync）
  let firstDecodeVideo = true
  let lastVideoKeyChunkIdx = 0
  let mp4File: MP4File | null = null

  let firstVideoSamp = true
  const stopReadStream = autoReadStream(
    stream.pipeThrough(new SampleTransform()),
    {
      onDone: async () => {
        Log.info('demuxcode stream done')
        if (mp4Info == null) throw Error('MP4 demux unready')
        try {
          await Promise.all([
            vdecoder.state === 'configured' ? vdecoder.flush() : null,
            adecoder.state === 'configured' ? adecoder.flush() : null
          ])
          Log.info('demuxcode decode done')
          cbs.onComplete()
        } catch (err) {
          Log.info(err)
        }
      },
      onChunk: async ({ chunkType, data }) => {
        if (chunkType === 'ready') {
          Log.info('demuxcode chunk ready, info:', data)
          mp4File = data.file
          mp4Info = data.info
          const { videoDecoderConf, audioDecoderConf } = extractFileConfig(
            data.file,
            data.info
          )

          if (videoDecoderConf != null) {
            vdecoder.configure(videoDecoderConf)
          } else {
            throw new Error('MP4 file does not include a video track or uses an unsupported codec')
          }
          if (opts.audio && audioDecoderConf != null) {
            adecoder.configure(audioDecoderConf)
          }

          cbs.onReady(data.info)
          return
        } else if (chunkType === 'samples') {
          const { id: curId, type, samples } = data
          for (let i = 0; i < samples.length; i += 1) {
            const s = samples[i]
            if (firstDecodeVideo && s.is_sync) lastVideoKeyChunkIdx = i

            const cts = (1e6 * s.cts) / s.timescale
            // 跳过裁剪时间区间外的sample，无需解码
            if (cts < opts.start || cts > opts.end) continue

            if (type === 'video') {
              if (firstVideoSamp && i === 0 && s.cts !== 0) {
                // 兼容某些视频首帧 有偏移
                s.cts = 0
                firstVideoSamp = false
              } else {
                firstVideoSamp = true
              }
              if (firstDecodeVideo && !s.is_sync) {
                // 首次解码需要从 key chunk 开始
                firstDecodeVideo = false
                for (let j = lastVideoKeyChunkIdx; j < i; j++) {
                  vdecoder.decode(
                    new EncodedVideoChunk(sample2ChunkOpts(samples[j]))
                  )
                }
              }
              vdecoder.decode(new EncodedVideoChunk(sample2ChunkOpts(s)))
            } else if (type === 'audio' && opts.audio) {
              adecoder.decode(new EncodedAudioChunk(sample2ChunkOpts(s)))
            }
          }
          // 释放内存空间
          mp4File?.releaseUsedSamples(curId, samples.length)
        }
      }
    }
  )

  let stoped = false
  return {
    stop: () => {
      if (stoped) return
      stoped = true

      mp4File?.stop()
      stopReadStream()
      vdecoder.close()
      adecoder.close()
    }
  }
}

export function recodemux(opts: IWorkerOpts): {
  encodeVideo: (frame: VideoFrame, options?: VideoEncoderEncodeOptions) => void
  encodeAudio: (data: AudioData) => void
  close: TCleanFn
  flush: () => Promise<void>
  mp4file: MP4File
  getEecodeQueueSize: () => number
} {
  Log.info('recodemux opts:', opts)
  const mp4file = mp4box.createFile()

  // 音视频轨道必须同时创建, 保存在 moov 中
  const avSyncEvtTool = new EventTool<
    Record<'VideoReady' | 'AudioReady', () => void>
  >()
  const vEncoder = encodeVideoTrack(opts, mp4file, avSyncEvtTool)
  let aEncoder: AudioEncoder | null = null
  if (opts.audio == null) {
    avSyncEvtTool.emit('AudioReady')
  } else {
    aEncoder = encodeAudioTrack(opts.audio, mp4file, avSyncEvtTool)
  }

  let maxSize = 0
  return {
    encodeVideo: (vf, opts) => {
      vEncoder.encode(vf, opts)
      vf.close()

      if (vEncoder.encodeQueueSize > maxSize) maxSize = vEncoder.encodeQueueSize
    },
    encodeAudio: ad => {
      if (aEncoder == null) return
      aEncoder.encode(ad)
      ad.close()
    },
    getEecodeQueueSize: () => vEncoder.encodeQueueSize,
    flush: async () => {
      await Promise.all([
        vEncoder.state === 'configured' ? vEncoder.flush() : null,
        aEncoder?.state === 'configured' ? aEncoder.flush() : null
      ])
      return
    },
    close: () => {
      avSyncEvtTool.destroy()
      if (vEncoder.state === 'configured') vEncoder.close()
      if (aEncoder?.state === 'configured') aEncoder.close()
    },
    mp4file
  }
}

function encodeVideoTrack(
  opts: IWorkerOpts,
  mp4File: MP4File,
  avSyncEvtTool: EventTool<Record<'VideoReady' | 'AudioReady', () => void>>
): VideoEncoder {
  const videoTrackOpts = {
    // 微秒
    timescale: 1e6,
    width: opts.video.width,
    height: opts.video.height,
    brands: ['isom', 'iso2', 'avc1', 'mp42', 'mp41'],
    avcDecoderConfigRecord: null as ArrayBuffer | undefined | null
  }

  let trackId: number
  let cache: EncodedVideoChunk[] = []
  let audioReady = false
  avSyncEvtTool.once('AudioReady', () => {
    audioReady = true
    cache.forEach(c => {
      const s = chunk2MP4SampleOpts(c)
      mp4File.addSample(trackId, s.data, s)
    })
    cache = []
  })
  const encoder = createVideoEncoder(opts, (chunk, meta) => {
    if (trackId == null && meta != null) {
      videoTrackOpts.avcDecoderConfigRecord = meta.decoderConfig?.description as ArrayBuffer
      trackId = mp4File.addTrack(videoTrackOpts)
      avSyncEvtTool.emit('VideoReady')
      Log.info('VideoEncoder, video track ready, trackId:', trackId)
    }

    if (audioReady) {
      const s = chunk2MP4SampleOpts(chunk)
      mp4File.addSample(trackId, s.data, s)
    } else {
      cache.push(chunk)
    }
  })

  return encoder
}

function createVideoEncoder(
  opts: IWorkerOpts,
  outHandler: EncodedVideoChunkOutputCallback
): VideoEncoder {
  const encoder = new VideoEncoder({
    error: Log.error,
    output: outHandler
  })

  const videoOpts = opts.video
  encoder.configure({
    codec: opts.video.codec,
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

function encodeAudioTrack(
  audioOpts: NonNullable<IWorkerOpts['audio']>,
  mp4File: MP4File,
  avSyncEvtTool: EventTool<Record<'VideoReady' | 'AudioReady', () => void>>
): AudioEncoder {
  const audioTrackOpts = {
    timescale: 1e6,
    samplerate: audioOpts.sampleRate,
    channel_count: audioOpts.channelCount,
    hdlr: 'soun',
    type: audioOpts.codec === 'aac' ? 'mp4a' : 'Opus'
  }

  let trackId = 0
  let cache: EncodedAudioChunk[] = []
  let videoReady = false
  avSyncEvtTool.once('VideoReady', () => {
    videoReady = true
    cache.forEach(c => {
      const s = chunk2MP4SampleOpts(c)
      mp4File.addSample(trackId, s.data, s)
    })
    cache = []
  })

  const encoder = new AudioEncoder({
    error: Log.error,
    output: (chunk, meta) => {
      if (trackId === 0) {
        // 某些设备不会输出 description
        const desc = meta.decoderConfig?.description
        trackId = mp4File.addTrack({
          ...audioTrackOpts,
          description: desc == null ? undefined : createESDSBox(desc)
        })
        avSyncEvtTool.emit('AudioReady')
        Log.info('AudioEncoder, audio track ready, trackId:', trackId)
      }

      if (videoReady) {
        const s = chunk2MP4SampleOpts(chunk)
        mp4File.addSample(trackId, s.data, s)
      } else {
        cache.push(chunk)
      }
    }
  })
  encoder.configure({
    codec: audioOpts.codec === 'aac' ? DEFAULT_AUDIO_CONF.codec : 'opus',
    sampleRate: audioOpts.sampleRate,
    numberOfChannels: audioOpts.channelCount,
    bitrate: 128_000
  })

  return encoder
}

export function _deprecated_stream2file(stream: ReadableStream<Uint8Array>): {
  file: MP4File
  stop: () => void
} {
  const reader = stream.getReader()
  let chunkOffset = 0
  const file = mp4box.createFile()
  let stoped = false
  async function readFile(): Promise<void> {
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
    reader.releaseLock()
    stream.cancel()
  }
  readFile().catch(Log.error)

  return {
    file,
    stop: () => {
      stoped = true
    }
  }
}



export function file2stream(
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
  const tracks: Array<{ track: TrakBoxParser; id: number }> = []

  const deltaBuf = (): Uint8Array | null => {
    // boxes.length >= 4 表示完成了 ftyp moov，且有了第一个 moof mdat
    // 避免moov未完成时写入文件，导致文件无法被识别
    if (boxes.length < 4 || sendedBoxIdx >= boxes.length) return null

    if (tracks.length === 0) {
      for (let i = 1; true; i += 1) {
        const track = file.getTrackById(i)
        if (track == null) break
        tracks.push({ track, id: i })
      }
    }

    const ds = new mp4box.DataStream()
    ds.endianness = mp4box.DataStream.BIG_ENDIAN

    for (let i = sendedBoxIdx; i < boxes.length; i++) {
      boxes[i].write(ds)
      delete boxes[i]
    }
    // 释放引用，避免内存泄露
    tracks.forEach(({ track, id }) => {
      file.releaseUsedSamples(id, track.samples.length)
      track.samples = []
    })
    file.mdats = []
    file.moofs = []

    sendedBoxIdx = boxes.length
    return new Uint8Array(ds.buffer)
  }

  let stoped = false
  let canceled = false
  let exit: TCleanFn | null = null
  const stream = new ReadableStream({
    start(ctrl) {
      timerId = self.setInterval(() => {
        const d = deltaBuf()
        if (d != null && !canceled) ctrl.enqueue(d)
      }, timeSlice)

      exit = () => {
        clearInterval(timerId)
        file.flush()
        const d = deltaBuf()
        if (d != null && !canceled) ctrl.enqueue(d)

        if (!canceled) ctrl.close()
      }

      // 安全起见，检测如果start触发时已经 stoped
      if (stoped) exit()
    },
    cancel() {
      canceled = true
      clearInterval(timerId)
      onCancel?.()
    }
  })

  return {
    stream,
    stop: () => {
      if (stoped) return
      stoped = true
      exit?.()
    }
  }
}

function mp4File2OPFSFile(inMP4File: MP4File): () => (Promise<File | null>) {
  let sendedBoxIdx = 0
  const boxes = inMP4File.boxes
  const tracks: Array<{ track: TrakBoxParser; id: number }> = []
  let totalDuration = 0

  async function write2TmpFile() {
    const buf = box2Buf(boxes, sendedBoxIdx)
    sendedBoxIdx = boxes.length
    // 释放引用，避免内存泄露
    tracks.forEach(({ track, id }) => {
      const s = track.samples.at(-1)
      if (s != null) totalDuration = Math.max(totalDuration, s.cts + s.duration)

      inMP4File.releaseUsedSamples(id, track.samples.length)
      track.samples = []
    })
    inMP4File.mdats = []
    inMP4File.moofs = []
    if (buf != null) await tmpFileWriter?.write(buf)
  }

  let moovPrevBoxes: typeof boxes = []
  function moovBoxReady() {
    if (moovPrevBoxes.length > 0) return true

    const moovIdx = boxes.findIndex(box => box.type === 'moov')
    if (moovIdx === -1) return false

    moovPrevBoxes = boxes.slice(0, moovIdx + 1)
    sendedBoxIdx = moovIdx + 1

    if (tracks.length === 0) {
      for (let i = 1; true; i += 1) {
        const track = inMP4File.getTrackById(i)
        if (track == null) break
        tracks.push({ track, id: i })
      }
    }

    return true
  }

  let timerId = 0
  let tmpFileHandle: FileSystemFileHandle | null = null
  let tmpFileWriter: FileSystemWritableFileStream | null = null

  const initPromise = (async () => {
    const opfsRoot = await navigator.storage.getDirectory()
    tmpFileHandle = await opfsRoot.getFileHandle(
      Math.random().toString(),
      { create: true }
    )
    tmpFileWriter = await tmpFileHandle.createWritable()

    timerId = self.setInterval(() => {
      if (!moovBoxReady()) return
      write2TmpFile()
    }, 100)
  })()

  let stoped = false
  return async () => {
    if (stoped) throw Error('File exported')
    stoped = true

    await initPromise
    clearInterval(timerId)

    if (!moovBoxReady() || tmpFileHandle == null) return null
    inMP4File.flush()
    await write2TmpFile()
    await tmpFileWriter?.close()

    const moov = moovPrevBoxes.find(box => box.type === 'moov') as (typeof inMP4File.moov | undefined)
    if (moov == null) return null

    moov.mvhd.duration = totalDuration

    const opfsRoot = await navigator.storage.getDirectory()
    const rsFileHandle = await opfsRoot.getFileHandle(
      Math.random().toString(),
      { create: true }
    )
    const writer = await rsFileHandle.createWritable()
    const buf = box2Buf(moovPrevBoxes, 0)!
    await writer.write(buf)
    await writer.write(await tmpFileHandle.getFile())
    await writer.close()

    return await rsFileHandle.getFile()
  }

  function box2Buf(source: typeof boxes, startIdx: number): Uint8Array | null {
    if (startIdx >= source.length) return null

    const ds = new mp4box.DataStream()
    ds.endianness = mp4box.DataStream.BIG_ENDIAN

    for (let i = startIdx; i < source.length; i++) {
      if (source[i] === null) continue
      source[i].write(ds)
      delete source[i]
    }
    return new Uint8Array(ds.buffer)
  }
}

/**
 * EncodedAudioChunk | EncodedVideoChunk 转换为 MP4 addSample 需要的参数
 */
function chunk2MP4SampleOpts(
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



/**
 * 快速顺序合并多个mp4流，要求所有mp4的属性是一致的
 * 属性包括（不限于）：音视频编码格式、分辨率、采样率
 */
export async function fastConcatMP4(streams: ReadableStream<Uint8Array>[]): Promise<ReadableStream<Uint8Array>> {
  Log.info('fastConcatMP4, streams len:', streams.length)
  const outfile = mp4box.createFile()

  const dumpFile = mp4File2OPFSFile(outfile)
  await concatStreamsToMP4BoxFile(streams, outfile)
  const opfsFile = await dumpFile()
  if (opfsFile == null) throw Error('Can not generate file from streams')
  return opfsFile.stream()
}

async function concatStreamsToMP4BoxFile(streams: ReadableStream<Uint8Array>[], outfile: MP4File) {
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
      let curFile: MP4File | null = null
      autoReadStream(stream.pipeThrough(new SampleTransform()), {
        onDone: resolve,
        onChunk: async ({ chunkType, data }) => {
          if (chunkType === 'ready') {
            const { videoTrackConf, audioTrackConf } = extractFileConfig(
              data.file,
              data.info
            )
            curFile = data.file
            if (vTrackId === 0 && videoTrackConf != null) {
              vTrackId = outfile.addTrack(videoTrackConf)
            }
            if (aTrackId === 0 && audioTrackConf != null) {
              aTrackId = outfile.addTrack(audioTrackConf)
            }
          } else if (chunkType === 'samples') {
            const { id: curId, type, samples } = data
            const trackId = type === 'video' ? vTrackId : aTrackId
            const offsetDTS = type === 'video' ? vDTS : aDTS
            const offsetCTS = type === 'video' ? vCTS : aCTS

            samples.forEach(s => {
              outfile.addSample(trackId, s.data, {
                duration: s.duration,
                dts: s.dts + offsetDTS,
                cts: s.cts + offsetCTS,
                is_sync: s.is_sync
              })
            })
            curFile?.releaseUsedSamples(curId, samples.length)

            const lastSamp = samples.at(-1)
            if (lastSamp == null) return
            if (type === 'video') {
              lastVSamp = lastSamp
            } else if (type === 'audio') {
              lastASamp = lastSamp
            }
          }
        }
      })
    })
    if (lastVSamp != null) {
      vDTS += lastVSamp.dts
      vCTS += lastVSamp.cts
    }
    if (lastASamp != null) {
      aDTS += lastASamp.dts
      aCTS += lastASamp.cts
    }
  }
}

/**
 * Convert live stream to OPFS File, fix duration being 0
 * @param stream mp4 file stream
 * @returns File
 */
export async function mp4StreamToOPFSFile(stream: ReadableStream<Uint8Array>): Promise<File> {
  const outfile = mp4box.createFile()

  const dumpFile = mp4File2OPFSFile(outfile)
  await concatStreamsToMP4BoxFile([stream], outfile)
  const opfsFile = await dumpFile()
  if (opfsFile == null) throw Error('Can not generate file from stream')
  return opfsFile
}

function createMP4AudioSampleDecoder(
  adConf: Parameters<AudioDecoder['configure']>[0]
) {
  let cacheAD: AudioData[] = []
  const adDecoder = new AudioDecoder({
    output: ad => {
      cacheAD.push(ad)
    },
    error: Log.error
  })
  adDecoder.configure(adConf)

  return {
    decode: async (ss: MP4Sample[]) => {
      ss.forEach(s => {
        adDecoder.decode(
          new EncodedAudioChunk({
            type: s.is_sync ? 'key' : 'delta',
            timestamp: (1e6 * s.cts) / s.timescale,
            duration: (1e6 * s.duration) / s.timescale,
            data: s.data
          })
        )
      })

      await adDecoder.flush()

      const rs = cacheAD
      cacheAD = []

      return rs
    },
    close: () => {
      adDecoder.close()
    }
  }
}

// 音频编码与解码API有很大区别，
// 是因为编码中途调用 AudioEncoder.flush ，会导致声音听起来卡顿
function createMP4AudioSampleEncoder(
  aeConf: Parameters<AudioEncoder['configure']>[0],
  onOutput: (s: ReturnType<typeof chunk2MP4SampleOpts>) => void
) {
  const adEncoder = new AudioEncoder({
    output: chunk => {
      onOutput(chunk2MP4SampleOpts(chunk))
    },
    error: Log.error
  })

  adEncoder.configure({
    codec: aeConf.codec,
    sampleRate: aeConf.sampleRate,
    numberOfChannels: aeConf.numberOfChannels
  })

  // 保留一个音频数据，用于最后做声音淡出
  let lastData: { data: Float32Array; ts: number } | null = null

  function createAD(data: Float32Array, ts: number) {
    return new AudioData({
      timestamp: ts,
      numberOfChannels: aeConf.numberOfChannels,
      numberOfFrames: data.length / aeConf.numberOfChannels,
      sampleRate: aeConf.sampleRate,
      format: 'f32-planar',
      data
    })
  }
  return {
    encode: async (data: Float32Array, ts: number) => {
      if (lastData != null) {
        adEncoder.encode(createAD(lastData.data, lastData.ts))
      }
      lastData = { data, ts }
    },
    stop: async () => {
      if (lastData != null) {
        // 副作用修改数据
        audioFade(lastData.data, aeConf.numberOfChannels, aeConf.sampleRate)
        adEncoder.encode(createAD(lastData.data, lastData.ts))
        lastData = null
      }
      await adEncoder.flush()
      adEncoder.close()
    }
  }
}

/**
 * 音频线性淡出，避免 POP 声
 * 副作用调整音量值
 */
function audioFade(pcmData: Float32Array, chanCnt: number, sampleRate: number) {
  const dataLen = pcmData.length - 1
  // 避免超出边界，最长 500ms 的淡出时间
  const fadeLen = Math.min(sampleRate / 2, dataLen)
  for (let i = 0; i < fadeLen; i++) {
    for (let j = 1; j <= chanCnt; j++) {
      // 从尾部开始，调整每个声道音量值
      pcmData[Math.floor(dataLen / j) - i] *= i / fadeLen
    }
  }
}

/**
 * 混合mp4与音频文件，仅重编码音频
 * @returns
 */
export function mixinMP4AndAudio(
  mp4Stream: ReadableStream<Uint8Array>,
  audio: {
    stream: ReadableStream<Uint8Array>
    volume: number
    loop: boolean
  }
) {
  Log.info('mixinMP4AndAudio, opts:', {
    volume: audio.volume,
    loop: audio.loop
  })

  const outfile = mp4box.createFile()
  const { stream: outStream, stop: stopOut } = file2stream(outfile, 500)

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
  let mp4HasAudio = true
  let sampleRate = 48000
  autoReadStream(mp4Stream.pipeThrough(new SampleTransform()), {
    onDone: async () => {
      await audioSampleEncoder?.stop()
      audioSampleDecoder?.close()
      stopOut()
    },
    onChunk: async ({ chunkType, data }) => {
      if (chunkType === 'ready') {
        const { videoTrackConf, audioTrackConf, audioDecoderConf } =
          extractFileConfig(data.file, data.info)
        if (vTrackId === 0 && videoTrackConf != null) {
          vTrackId = outfile.addTrack(videoTrackConf)
        }

        const safeAudioTrackConf = audioTrackConf ?? {
          timescale: 1e6,
          samplerate: sampleRate,
          channel_count: DEFAULT_AUDIO_CONF.channelCount,
          hdlr: 'soun',
          name: 'SoundHandler',
          type: 'mp4a'
        }
        if (aTrackId === 0) {
          aTrackId = outfile.addTrack(safeAudioTrackConf)
          sampleRate = audioTrackConf?.samplerate ?? sampleRate
          mp4HasAudio = audioTrackConf == null ? false : true
        }
        const audioCtx = new AudioContext({ sampleRate })
        inputAudioPCM = extractPCM4AudioBuffer(
          await audioCtx.decodeAudioData(
            await new Response(audio.stream).arrayBuffer()
          )
        )

        if (audioDecoderConf != null) {
          audioSampleDecoder = createMP4AudioSampleDecoder(audioDecoderConf)
        }
        audioSampleEncoder = createMP4AudioSampleEncoder(
          audioDecoderConf ?? {
            codec:
              safeAudioTrackConf.type === 'mp4a'
                ? DEFAULT_AUDIO_CONF.codec
                : safeAudioTrackConf.type,
            numberOfChannels: safeAudioTrackConf.channel_count,
            sampleRate: safeAudioTrackConf.samplerate
          },
          s => outfile.addSample(aTrackId, s.data, s)
        )
      } else if (chunkType === 'samples') {
        const { id, type, samples } = data
        if (type === 'video') {
          samples.forEach(s => outfile.addSample(id, s.data, s))

          if (!mp4HasAudio) await addInputAudio2Track(samples)
          return
        }

        if (type === 'audio') await mixinAudioSampleAndInputPCM(samples)
      }
    }
  })

  function getInputAudioSlice(len: number) {
    const rs = inputAudioPCM.map(chanBuf =>
      audio.loop
        ? ringSliceFloat32Array(chanBuf, audioOffset, audioOffset + len)
        : chanBuf.slice(audioOffset, audioOffset + len)
    )
    audioOffset += len

    if (audio.volume !== 1) {
      for (const buf of rs)
        for (let i = 0; i < buf.length; i++) buf[i] *= audio.volume
    }

    return rs
  }

  async function addInputAudio2Track(vdieoSamples: MP4Sample[]) {
    const firstSamp = vdieoSamples[0]
    const lastSamp = vdieoSamples[vdieoSamples.length - 1]
    const pcmLength = Math.floor(
      ((lastSamp.cts + lastSamp.duration - firstSamp.cts) /
        lastSamp.timescale) *
      sampleRate
    )
    const audioDataBuf = mixinPCM([getInputAudioSlice(pcmLength)])
    if (audioDataBuf.length === 0) return
    audioSampleEncoder?.encode(
      audioDataBuf,
      (firstSamp.cts / firstSamp.timescale) * 1e6
    )
  }

  async function mixinAudioSampleAndInputPCM(samples: MP4Sample[]) {
    if (audioSampleDecoder == null) return

    // 1. 先解码mp4音频
    // [[chan0, chan1], [chan0, chan1]...]
    const pcmFragments = (await audioSampleDecoder.decode(samples)).map(
      extractPCM4AudioData
    )
    // [chan0, chan1]
    const mp4AudioPCM = concatPCMFragments(pcmFragments)
    const inputAudioPCM = getInputAudioSlice(mp4AudioPCM[0].length)
    const firstSamp = samples[0]

    // 3. 重编码音频
    audioSampleEncoder?.encode(
      // 2. 混合输入的音频
      mixinPCM([mp4AudioPCM, inputAudioPCM]),
      (firstSamp.cts / firstSamp.timescale) * 1e6
    )
  }

  return outStream
}

function createESDSBox(config: ArrayBuffer | ArrayBufferView) {
  const configlen = config.byteLength
  const buf = new Uint8Array([
    0x00, // version 0
    0x00,
    0x00,
    0x00, // flags

    0x03, // descriptor_type
    0x17 + configlen, // length
    0x00,
    // 0x01, // es_id
    0x02, // es_id
    0x00, // stream_priority

    0x04, // descriptor_type
    0x12 + configlen, // length
    0x40, // codec : mpeg4_audio
    0x15, // stream_type
    0x00,
    0x00,
    0x00, // buffer_size
    0x00,
    0x00,
    0x00,
    0x00, // maxBitrate
    0x00,
    0x00,
    0x00,
    0x00, // avgBitrate

    0x05, // descriptor_type

    configlen,
    ...new Uint8Array(config instanceof ArrayBuffer ? config : config.buffer),

    0x06,
    0x01,
    0x02
  ])

  const esdsBox = new mp4box.BoxParser.esdsBox(buf.byteLength)
  esdsBox.hdr_size = 0
  esdsBox.parse(new mp4box.DataStream(buf, 0, mp4box.DataStream.BIG_ENDIAN))
  return esdsBox
}

