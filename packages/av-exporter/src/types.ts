export interface IEncoderConf {
  width: number
  height: number
  fps?: number
  /* 码率 */
  bitrate?: number
  videoFrameStream: ReadableStream<VideoFrame>
}
