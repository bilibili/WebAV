
declare module 'mp4box' {

  interface MP4MediaTrack {
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

  interface MP4VideoData {
    width: number
    height: number
  }

  interface MP4VideoTrack extends MP4MediaTrack {
    video: MP4VideoData
  }

  interface MP4AudioData {
    sample_rate: number
    channel_count: number
    sample_size: number
  }

  interface MP4AudioTrack extends MP4MediaTrack {
    audio: MP4AudioData
  }

  type MP4Track = MP4VideoTrack | MP4AudioTrack

  interface MP4Info {
    duration: number
    timescale: number
    fragment_duration: number
    isFragmented: boolean
    isProgressive: boolean
    hasIOD: boolean
    brands: string[]
    created: Date
    modified: Date
    tracks: MP4Track[]
  }

  export type MP4ArrayBuffer = ArrayBuffer & { fileStart: number }

  interface MP4Box {
    write: (dataStream: DataStream) => void
  }

  const DataStream: {
    BIG_ENDIAN: unknown
    END_ENDIAN: unknown
    prototype: DataStream
    new(): DataStream
  }

  interface DataStream {
    buffer: ArrayBuffer
    endianness: unknown
  }

  interface VideoTrackOpts {
    timescale: number
    width: number
    height: number
    brands: string[]
    avcDecoderConfigRecord: AllowSharedBufferSource | undefined | null
  }

  interface AudioTrackOpts {
    timescale: number
    media_duration: number
    duration: number
    nb_samples: number
    samplerate: number
    hdlr: string
    name: string
    type: string
  }

  interface SampleOpts {
    duration: number
    dts?: number
    cts?: number
    is_sync: boolean
  }

  export interface MP4File {
    boxes: MP4Box[]

    addTrack: (opts: VideoTrackOpts | AudioTrackOpts) => number
    addSample: (trackId: number, buf: ArrayBuffer, sample: SampleOpts) => void

    onMoovStart?: () => void
    onReady?: (info: MP4Info) => void
    onError?: (e: string) => void

    appendBuffer: (data: MP4ArrayBuffer) => number
    start: () => void
    stop: () => void
    flush: () => void

  }

  export function createFile (): MP4File

  const DefExp: {
    MP4File: MP4File
    createFile: () => MP4File
    DataStream: typeof DataStream
  }

  export default DefExp
}
