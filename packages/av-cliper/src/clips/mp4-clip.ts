import { MP4Info, MP4Sample } from '@webav/mp4box.js';
import {
  autoReadStream,
  concatPCMFragments,
  createAudioChunksDecoder,
  createGoPVideoDecoder,
  sleep,
} from '../av-utils';
import { Log } from '../log';
import { demuxcode } from '../mp4-utils';
import { extractFileConfig, sample2ChunkOpts } from '../mp4-utils/mp4box-utils';
import { SampleTransform } from '../mp4-utils/sample-transform';
import { DEFAULT_AUDIO_CONF, IClip } from './iclip';

let CLIP_ID = 0;

export class MP4Clip implements IClip {
  #log = Log.create(`MP4Clip id:${CLIP_ID++},`);

  ready: IClip['ready'];

  #destroyed = false;

  #meta = {
    // 微秒
    duration: 0,
    width: 0,
    height: 0,
    audioSampleRate: DEFAULT_AUDIO_CONF.sampleRate,
    audioChanCount: DEFAULT_AUDIO_CONF.channelCount,
  };

  #volume = 1;

  #demuxcoder: ReturnType<typeof demuxcode> | null = null;

  #videoSamples: MP4Sample[] = [];

  #audioSamples: MP4Sample[] = [];

  #videoGoPDec: ReturnType<typeof createGoPVideoDecoder> | null = null;
  #audioChunksDec: ReturnType<typeof createAudioChunksDecoder> | null = null;

  constructor(
    rs: ReadableStream<Uint8Array>,
    opts: {
      audio?: boolean | { volume: number };
    } = {},
  ) {
    this.ready = new Promise((resolve, reject) => {
      this.#volume =
        typeof opts.audio === 'object' && 'volume' in opts.audio
          ? opts.audio.volume
          : 1;
      // let mp4File: MP4File;
      let mp4Info: MP4Info;
      const stopRead = autoReadStream(rs.pipeThrough(new SampleTransform()), {
        onChunk: async ({ chunkType, data }) => {
          if (chunkType === 'ready') {
            this.#log.info('mp4BoxFile is ready', data);
            // mp4File = data.file;
            mp4Info = data.info;
            const { videoDecoderConf, audioDecoderConf } = extractFileConfig(
              data.file,
              data.info,
            );

            if (videoDecoderConf != null) {
              this.#videoGoPDec = createGoPVideoDecoder(videoDecoderConf);
            } else {
              stopRead();
              reject(
                Error(
                  'MP4 file does not include a video track or uses an unsupported codec',
                ),
              );
            }
            if (opts.audio && audioDecoderConf != null) {
              this.#audioChunksDec = createAudioChunksDecoder(
                audioDecoderConf,
                DEFAULT_AUDIO_CONF.sampleRate,
              );
            }
          } else if (chunkType === 'samples') {
            if (data.type === 'video') {
              this.#videoSamples = this.#videoSamples.concat(
                data.samples.map((s) => ({
                  ...s,
                  cts: (s.cts / s.timescale) * 1e6,
                  dts: (s.dts / s.timescale) * 1e6,
                  duration: (s.duration / s.timescale) * 1e6,
                  timescale: 1e6,
                })),
              );
            } else if (data.type === 'audio') {
              this.#audioSamples = this.#audioSamples.concat(data.samples);
            }
          }
        },
        onDone: () => {
          const lastSampele = this.#videoSamples.at(-1);
          if (mp4Info == null || lastSampele == null) {
            reject(Error('MP4Clip stream is done, but not emit ready'));
            return;
          }
          const videoTrack = mp4Info.videoTracks[0];
          const width = videoTrack.track_width;
          const height = videoTrack.track_height;
          const duration = lastSampele.cts + lastSampele.duration;
          this.#meta = {
            duration,
            width,
            height,
            audioSampleRate: DEFAULT_AUDIO_CONF.sampleRate,
            audioChanCount: DEFAULT_AUDIO_CONF.channelCount,
          };
          resolve({ duration, width, height });
        },
      });
    });
  }

  #videoDecoding = false;
  #videoDecCusorIdx = 0;
  #videoFrames: VideoFrame[] = [];
  async #nextVideo(time: number): Promise<VideoFrame | null> {
    if (this.#destroyed) return null;

    if (this.#videoFrames.length > 0) {
      const rs = this.#videoFrames[0];
      if (time < rs.timestamp) return null;
      // 弹出第一帧
      this.#videoFrames.shift();
      // 第一帧过期，找下一帧
      if (time > rs.timestamp + (rs.duration ?? 0)) {
        rs.close();
        return this.#nextVideo(time);
      }
      // 符合期望
      return rs;
    }

    // decode completed
    if (
      !this.#videoDecoding &&
      this.#videoDecCusorIdx >= this.#videoSamples.length
    ) {
      return null;
    }

    // 缺少帧数据
    if (this.#videoDecoding) {
      // 解码中，等待，然后重试
      await sleep(15);
    } else {
      // 启动解码任务，然后重试
      let endIdx = this.#videoDecCusorIdx + 1;
      for (; endIdx < this.#videoSamples.length; endIdx++) {
        if (this.#videoSamples[endIdx].is_sync) break;
      }

      this.#videoDecoding = true;
      this.#videoGoPDec?.decode(
        this.#videoSamples
          .slice(this.#videoDecCusorIdx, endIdx)
          .map((s) => new EncodedVideoChunk(sample2ChunkOpts(s))),
        (vf, done) => {
          if (vf != null) this.#videoFrames.push(vf);
          if (done) this.#videoDecoding = false;
        },
      );
      this.#videoDecCusorIdx = endIdx;
    }
    return this.#nextVideo(time);
  }

  #pcmData: [Float32Array, Float32Array] = [
    new Float32Array(0), // left chan
    new Float32Array(0), // right chan
  ];
  #audioDecCusorIdx = 0;
  #audioDecoding = false;
  async #nextAudio(deltaTime: number): Promise<Float32Array[]> {
    const frameCnt = Math.ceil(deltaTime * (this.#meta.audioSampleRate / 1e6));
    if (this.#audioChunksDec == null || this.#destroyed || frameCnt === 0) {
      return [];
    }

    // 数据满足需要
    if (this.#pcmData[0].length > frameCnt) {
      const audio = [
        this.#pcmData[0].slice(0, frameCnt),
        this.#pcmData[1].slice(0, frameCnt),
      ];
      this.#pcmData[0] = this.#pcmData[0].slice(frameCnt);
      this.#pcmData[1] = this.#pcmData[1].slice(frameCnt);
      return audio;
    }

    // decode completed
    if (this.#audioDecCusorIdx >= this.#audioSamples.length) return [];

    if (this.#audioDecoding) {
      // 解码中，等待
      await sleep(15);
    } else {
      // 启动解码任务
      const endIdx = this.#audioDecCusorIdx + 10;
      this.#audioDecoding = true;
      this.#audioChunksDec.decode(
        this.#audioSamples
          .slice(this.#audioDecCusorIdx, endIdx)
          .map((s) => new EncodedAudioChunk(sample2ChunkOpts(s))),
        (pcmArr, done) => {
          if (pcmArr.length === 0) return;
          // 音量调节
          if (this.#volume !== 1) {
            for (const pcm of pcmArr)
              for (let i = 0; i < pcm.length; i++) pcm[i] *= this.#volume;
          }
          // 补齐双声道
          if (pcmArr.length === 1) pcmArr = [pcmArr[0], pcmArr[0]];

          this.#pcmData = concatPCMFragments([this.#pcmData, pcmArr]) as [
            Float32Array,
            Float32Array,
          ];
          if (done) this.#audioDecoding = false;
        },
      );
      this.#audioDecCusorIdx = endIdx;
    }
    return this.#nextAudio(deltaTime);
  }

  // 默认直接返回
  tickInterceptor: NonNullable<IClip['tickInterceptor']> = async (_, tickRet) =>
    tickRet;

  // last tick time
  #ts = 0;
  async tick(time: number): Promise<{
    video?: VideoFrame;
    audio: Float32Array[];
    state: 'success' | 'done';
  }> {
    if (time < this.#ts) throw Error('time not allow rollback');
    if (time >= this.#meta.duration) {
      return await this.tickInterceptor<MP4Clip>(time, {
        audio: [],
        state: 'done',
      });
    }

    const [audio, video] = await Promise.all([
      this.#nextAudio(time - this.#ts),
      this.#nextVideo(time),
    ]);
    this.#ts = time;
    if (video == null) {
      return await this.tickInterceptor<MP4Clip>(time, {
        audio,
        state: 'success',
      });
    }

    return await this.tickInterceptor<MP4Clip>(time, {
      video,
      audio,
      state: 'success',
    });
  }

  async getVideoFrame(time: number): Promise<VideoFrame | null> {
    if (time < 0 || time > this.#meta.duration) return null;
    const gop = findGoPSampleByTime(
      time,
      [0, this.#videoSamples.length],
      this.#videoSamples,
    );
    return new Promise<VideoFrame | null>((resolve) => {
      this.#videoGoPDec?.decode(
        gop.map((s) => new EncodedVideoChunk(sample2ChunkOpts(s))),
        (vf, done) => {
          if (done) resolve(vf);
          else vf?.close();
        },
      );
    });
  }

  deleteRange(startTime: number, endTime: number) {}

  destroy(): void {
    if (this.#destroyed) return;
    this.#log.info(
      'MP4Clip destroy, ts:',
      this.#ts,
      ', remainder frame count:',
      this.#videoFrames.length,
    );
    this.#destroyed = true;

    this.#demuxcoder?.stop();
    this.#demuxcoder = null;
    this.#videoFrames.forEach((f) => f.close());
    this.#videoFrames = [];
  }
}

function findGoPSampleByTime(
  time: number,
  range: [number, number],
  samples: MP4Sample[],
): MP4Sample[] {
  const idx = Math.floor((range[1] - range[0]) / 2) + range[0];
  const s = samples[idx];
  if (s == null) throw Error('not found GoP');

  const start = s.cts;
  const end = s.cts + s.duration;
  if (time >= start && time <= end) {
    const syncIdx = findLastSyncSampleIdx(idx);
    return samples.slice(syncIdx, idx);
  } else if (time < start) {
    if (idx <= range[0]) return [];
    return findGoPSampleByTime(time, [0, idx], samples);
  } else {
    if (idx > range[1]) return [];
    return findGoPSampleByTime(time, [idx + 1, range[1]], samples);
  }

  function findLastSyncSampleIdx(sampleIdx: number) {
    for (let i = sampleIdx; i >= 0; i--) {
      if (samples[i].is_sync) return i;
    }

    throw Error('not found sync sample');
  }
}
