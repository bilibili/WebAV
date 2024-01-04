declare module '@webav/mp4box.js' {
  export interface MP4MediaTrack {
    id: number
    created: Date
    modified: Date
    movie_duration: number
    layer: number
    alternate_group: number
    volume: number
    track_width: number
    track_height: number
    timescale: number
    duration: number
    bitrate: number
    codec: string
    language: string
    nb_samples: number
  }

  export interface MP4VideoTrack extends MP4MediaTrack {
    video: {
      width: number
      height: number
    }
  }

  export interface MP4AudioTrack extends MP4MediaTrack {
    audio: {
      sample_rate: number
      channel_count: number
      sample_size?: number
    }
  }

  export interface MP4Info {
    duration: number
    timescale: number
    fragment_duration: number
    isFragmented: boolean
    isProgressive: boolean
    hasIOD: boolean
    brands: string[]
    created: Date
    modified: Date
    tracks: Array<MP4VideoTrack | MP4AudioTrack>
    videoTracks: MP4VideoTrack[]
    audioTracks: MP4AudioTrack[]
  }

  export type MP4ArrayBuffer = ArrayBuffer & { fileStart: number }

  const DataStream: {
    BIG_ENDIAN: unknown
    END_ENDIAN: unknown
    prototype: DataStream
    new(
      size?: number | ArrayBufferView,
      byteOffset?: number,
      // @ts-expect-error
      endianness?: DataStream.BIG_ENDIAN | DataStream.END_ENDIAN
    ): DataStream
  }

  interface DataStream {
    buffer: ArrayBuffer
    endianness: unknown
  }

  export interface VideoTrackOpts {
    timescale: number
    duration?: number
    type?: string
    width: number
    height: number
    brands: string[]
    description_boxes?: AVCCBox[]
    avcDecoderConfigRecord?: AllowSharedBufferSource | undefined | null
  }

  export interface AudioTrackOpts {
    timescale: number
    media_duration?: number
    duration?: number
    samplerate: number
    channel_count: number
    samplesize?: number
    description?: ESDSBoxParser
    hdlr: string
    type: string
  }

  export interface SampleOpts {
    duration: number
    dts?: number
    cts?: number
    sample_description_index?: number
    is_sync: boolean
    description?: MP4ABoxParser | AVC1BoxParser
  }

  export interface MP4Sample {
    track_id: number
    description: MP4ABoxParser | AVC1BoxParser
    is_rap: boolean
    is_sync: boolean
    timescale: number
    dts: number
    cts: number
    duration: number
    size: number
    data: ArrayBuffer
  }

  interface BoxParser {
    boxes: BoxParser[]
    size: number
    hdr_size: number
    start: number
    type: string
    write: (dataStream: DataStream) => void
    parse: (dataStream: DataStream) => void
  }

  export interface TrakBoxParser extends BoxParser {
    type: 'trak'
    samples: MP4Sample[]
    nextSample: number
    sample_size: number
    samples_duration: number
    mdia: MDIABoxParser
  }

  interface MDATBoxParser extends BoxParser {
    type: 'mdat'
    data: Uint8Array
  }

  interface MOOFBoxParser extends BoxParser {
    type: 'moof'
  }

  interface MDIABoxParser extends BoxParser {
    type: 'mdia'
    minf: MINFBoxParser
  }

  interface MINFBoxParser extends BoxParser {
    type: 'minf'
    stbl: STBLBoxParser
  }

  interface STBLBoxParser extends BoxParser {
    type: 'stbl'
    stsd: STSDBoxParser
  }

  interface ESDBoxParser extends BoxParser {
    tag: number
  }

  interface ESDSBoxParser extends BoxParser {
    type: 'esds'
    version: number
    flags: number
    esd: ESDBoxParser
    new(size: number): ESDSBoxParser
  }

  interface MOOVBoxParser extends BoxParser {
    type: 'moov'
    traks: TrakBoxParser[]
    mvhd: MVHDBoxParser
  }

  interface MVHDBoxParser extends BoxParser {
    type: 'mvhd'
    duration: number
    timescale: number
  }

  type STSDBoxParser = Omit<
    BoxParser & {
      type: 'stsd'
      entries: Array<AVC1BoxParser | HVCBoxParser | MP4ABoxParser>
    },
    'boxes'
  >

  export interface AVC1BoxParser extends BoxParser {
    type: 'avc1'
    boxes: AVCCBox[]
    avcC: AVCCBox
    compressorname: string
    frame_count: number
    height: number
    size: number
    start: number
    width: number
  }

  export interface HVCBoxParser extends BoxParser {
    type: 'hvc'
    boxes: HVCCBox[]
    hvcC: HVCCBox
    compressorname: string
    frame_count: number
    height: number
    size: number
    start: number
    width: number
  }

  interface AVCCBox extends BoxParser {
    PPS: Array<{ length: number; nalu: Uint8Array }>
    SPS: Array<{ length: number; nalu: Uint8Array }>
    type: 'avcC'
  }

  interface HVCCBox extends BoxParser {
    PPS: Array<{ length: number; nalu: Uint8Array }>
    SPS: Array<{ length: number; nalu: Uint8Array }>
    type: 'hvcC'
  }

  export interface MP4ABoxParser extends BoxParser {
    type: 'mp4a'
    channel_count: number
    samplerate: number
    samplesize: number
    size: number
    start: number
    boxes: []
    esds?: ESDSBoxParser
    getCodec: () => string
  }

  export interface MP4File {
    boxes: BoxParser[]
    mdats: MDATBoxParser[]
    moofs: MOOFBoxParser[]
    moov?: MOOVBoxParser

    addTrack: (opts: VideoTrackOpts | AudioTrackOpts) => number
    addSample: (trackId: number, buf: ArrayBuffer, sample: SampleOpts) => void
    releaseUsedSamples(id: number, usedCount: number): void

    getTrackById: (id: number) => TrakBoxParser
    setExtractionOptions: (
      id: number,
      user?: unknown,
      opts?: {
        nbSamples?: number
        rapAlignement?: boolean
      }
    ) => void

    onMoovStart?: () => void
    onReady?: (info: MP4Info) => void
    onSamples: (id: number, user: any, samples: MP4Sample[]) => void
    onError?: (e: string) => void

    appendBuffer: (data: MP4ArrayBuffer) => number
    start: () => void
    seek: (time: number, useRAP?: boolean) => { offset: number; time: number }
    stop: () => void
    write: (ds: DataStream) => void
    flush: () => void
    // 额外扩展的方法
    onFlush?: () => void
  }

  interface MPEG4DescriptorParser {
    new(): MPEG4DescriptorParser
    parseOneDescriptor(stream: DataStream): ESDBoxParser
  }

  export function createFile(): MP4File

  const DefExp: {
    MP4File: MP4File
    createFile: () => MP4File
    BoxParser: {
      esdsBox: ESDSBoxParser
    }
    DataStream: typeof DataStream
    MPEG4DescriptorParser: MPEG4DescriptorParser
    Log: {
      debug: () => void
      setLogLevel: (fn: () => void) => void
    }
  }

  export default DefExp
}
