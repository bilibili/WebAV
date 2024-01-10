export interface IRecorderConf {
  width?: number
  height?: number
  expectFPS?: number
  audioCodec?: 'aac'
  videoCodec?: string
  /* 码率 */
  bitrate?: number
}

export interface IWorkerOpts {
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
  streams: IStream
  timeSlice: number
}

export interface IStream {
  video?: ReadableStream<VideoFrame>
  audio?: ReadableStream<AudioData>
}

export enum EWorkerMsg {
  SafeExit = 'SafeExit',
  Stop = 'Stop',
  Paused = 'Paused',
  Start = 'Start',
  OutputStream = 'OutputStream'
}

export type TClearFn = () => void
export type TAsyncClearFn = () => Promise<void>
