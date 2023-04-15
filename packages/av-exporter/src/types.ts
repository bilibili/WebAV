export interface IRecorderConf {
  width?: number
  height?: number
  fps?: number
  /* 码率 */
  bitrate?: number
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
