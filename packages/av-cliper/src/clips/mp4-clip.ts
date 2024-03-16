import { MP4File, MP4Info, MP4Sample } from '@webav/mp4box.js';
import {
  audioResample,
  autoReadStream,
  concatFloat32Array,
  extractPCM4AudioData,
  sleep,
} from '../av-utils';
import { Log } from '../log';
import { demuxcode } from '../mp4-utils';
import { extractFileConfig } from '../mp4-utils/mp4box-utils';
import { SampleTransform } from '../mp4-utils/sample-transform';
import { DEFAULT_AUDIO_CONF, IClip } from './iclip';

let CLIP_ID = 0;

export class MP4Clip implements IClip {
  #log = Log.create(`MP4Clip id:${CLIP_ID++},`);

  #videoFrames: VideoFrame[] = [];

  ready: IClip['ready'];

  #destroyed = false;
  #decodeEnded = false;

  #meta = {
    // 微秒
    duration: 0,
    width: 0,
    height: 0,
    audioSampleRate: DEFAULT_AUDIO_CONF.sampleRate,
    audioChanCount: DEFAULT_AUDIO_CONF.channelCount,
  };

  #audioChan0 = new Float32Array(0);
  #audioChan1 = new Float32Array(0);

  #volume = 1;

  #hasAudioTrack = false;

  #demuxcoder: ReturnType<typeof demuxcode> | null = null;

  // #cacheFile = file(`/.cache/mp4clip/${Math.random()}`);

  #videoSamples: MP4Sample[] = [];

  #audioSamples: MP4Sample[] = [];

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
              // vdecoder.configure(videoDecoderConf);
            } else {
              stopRead();
              reject(
                Error(
                  'MP4 file does not include a video track or uses an unsupported codec',
                ),
              );
            }
            if (opts.audio && audioDecoderConf != null) {
              // adecoder.configure(audioDecoderConf);
            }
          } else if (chunkType === 'samples') {
            if (data.type === 'video') {
              this.#videoSamples = this.#videoSamples.concat(data.samples);
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
          const duration =
            ((lastSampele.cts + lastSampele.duration) / lastSampele.timescale) *
            1e6;
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

  #audioData2PCMBuf = (() => {
    const resampleQ = createPromiseQueue<Float32Array[]>((resampedPCM) => {
      if (resampedPCM instanceof Error) throw resampedPCM;

      this.#audioChan0 = concatFloat32Array([this.#audioChan0, resampedPCM[0]]);
      this.#audioChan1 = concatFloat32Array([
        this.#audioChan1,
        resampedPCM[1] ?? resampedPCM[0],
      ]);
    });

    return (ad: AudioData) => {
      const pcmArr = extractPCM4AudioData(ad);
      // 音量调节
      if (this.#volume !== 1) {
        for (const pcm of pcmArr)
          for (let i = 0; i < pcm.length; i++) pcm[i] *= this.#volume;
      }

      if (ad.sampleRate !== DEFAULT_AUDIO_CONF.sampleRate) {
        resampleQ(() =>
          audioResample(pcmArr, ad.sampleRate, {
            rate: DEFAULT_AUDIO_CONF.sampleRate,
            chanCount: DEFAULT_AUDIO_CONF.channelCount,
          }),
        );
      } else {
        this.#audioChan0 = concatFloat32Array([this.#audioChan0, pcmArr[0]]);
        this.#audioChan1 = concatFloat32Array([
          this.#audioChan1,
          pcmArr[1] ?? pcmArr[0],
        ]);
      }

      ad.close();
    };
  })();

  async #nextVideo(time: number): Promise<VideoFrame | null> {
    if (this.#videoFrames.length === 0) {
      if (this.#destroyed || this.#decodeEnded) {
        return null;
      }

      await sleep(50);
      return this.#nextVideo(time);
    }

    const rs = this.#videoFrames[0];
    if (time < rs.timestamp) {
      return null;
    }
    if (time > rs.timestamp + (rs.duration ?? 0)) {
      // 过期，找下一帧
      this.#videoFrames.shift()?.close();
      return this.#nextVideo(time);
    }

    this.#videoFrames.shift();
    return rs;
  }

  async #nextAudio(deltaTime: number): Promise<Float32Array[]> {
    const frameCnt = Math.ceil(deltaTime * (this.#meta.audioSampleRate / 1e6));
    if (frameCnt === 0) return [];
    // 小心避免死循环
    if (
      !this.#decodeEnded &&
      !this.#destroyed &&
      this.#audioChan0.length < frameCnt
    ) {
      await sleep(50);
      return this.#nextAudio(deltaTime);
    }

    const audio = [
      this.#audioChan0.slice(0, frameCnt),
      this.#audioChan1.slice(0, frameCnt),
    ];

    this.#audioChan0 = this.#audioChan0.slice(frameCnt);
    if (this.#meta.audioChanCount > 1) {
      this.#audioChan1 = this.#audioChan1.slice(frameCnt);
    }
    return audio;
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
    if (this.#decodeEnded && time >= this.#meta.duration) {
      return await this.tickInterceptor<MP4Clip>(time, {
        audio: [],
        state: 'done',
      });
    }

    const audio = this.#hasAudioTrack
      ? await this.#nextAudio(time - this.#ts)
      : [];
    const video = await this.#nextVideo(time);
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

  deleteRange(startTime: number, endTime: number) {}

  destroy(): void {
    if (this.#destroyed) return;
    this.#log.info(
      'MP4Clip destroy, ts:',
      this.#ts,
      ', remainder frame count:',
      this.#videoFrames.length,
      ', decodeEnded:',
      this.#decodeEnded,
    );
    this.#destroyed = true;

    this.#demuxcoder?.stop();
    this.#demuxcoder = null;
    this.#videoFrames.forEach((f) => f.close());
    this.#videoFrames = [];
  }
}

// 并行执行任务，但按顺序emit结果
function createPromiseQueue<T extends any>(onResult: (data: T) => void) {
  const rsCache: T[] = [];
  let waitingIdx = 0;

  function updateRs(rs: T, emitIdx: number) {
    rsCache[emitIdx] = rs;
    emitRs();
  }

  function emitRs() {
    const rs = rsCache[waitingIdx];
    if (rs == null) return;
    onResult(rs);

    waitingIdx += 1;
    emitRs();
  }

  let addIdx = 0;
  return (task: () => Promise<T>) => {
    const emitIdx = addIdx;
    addIdx += 1;
    task()
      .then((rs) => updateRs(rs, emitIdx))
      .catch((err) => updateRs(err, emitIdx));
  };
}
