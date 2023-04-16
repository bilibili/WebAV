export interface IRecorderConf {
  width?: number
  height?: number
  expectFPS?: number
  audioCodec?: 'opus' | 'aac'
  /* 码率 */
  bitrate?: number
}

export interface IWorkerOpts {
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
  Start = 'Start',
  OutputStream = 'OutputStream'
}

export type TClearFn = () => void
export type TAsyncClearFn = () => Promise<void>
