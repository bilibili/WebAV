export interface AVRecorderConf {
  expectFPS?: number;
  videoCodec?: string;
  /* 码率 */
  bitrate?: number;
}

export interface IRecordeOpts {
  video: {
    width: number;
    height: number;
    expectFPS: number;
    codec: string;
  };
  audio: {
    codec: 'opus' | 'aac';
    sampleRate: number;
    channelCount: number;
  } | null;
  bitrate: number;
  streams: IStream;
  timeSlice: number;
}

export interface IStream {
  video?: ReadableStream<VideoFrame>;
  audio?: ReadableStream<AudioData>;
}

export type TClearFn = () => void;
export type TAsyncClearFn = () => Promise<void>;
