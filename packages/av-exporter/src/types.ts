export interface IEncoderConf {
  width: number
  height: number
  fps?: number
  /* 码率 */
  bitrate?: number
  streams: {
    video?: ReadableStream<VideoFrame>
    audio?: ReadableStream<AudioData>
  }
}

export type TClearFn = (() => Promise<void> | void) | null
