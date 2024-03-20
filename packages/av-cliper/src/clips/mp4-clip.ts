import { MP4Info, MP4Sample } from '@webav/mp4box.js';
import {
  autoReadStream,
  concatPCMFragments,
  createAudioChunksDecoder,
  createGoPVideoDecoder,
  sleep,
} from '../av-utils';
import { Log } from '../log';
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

  get meta() {
    return this.#meta;
  }

  #volume = 1;

  #videoSamples: Array<MP4Sample & { deleted?: boolean }> = [];

  #audioSamples: Array<MP4Sample & { deleted?: boolean }> = [];

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
              this.#audioSamples = this.#audioSamples.concat(
                data.samples.map((s) => ({
                  ...s,
                  cts: (s.cts / s.timescale) * 1e6,
                  dts: (s.dts / s.timescale) * 1e6,
                  duration: (s.duration / s.timescale) * 1e6,
                  timescale: 1e6,
                })),
              );
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

    // 缺少帧数据
    if (this.#videoDecoding) {
      // 解码中，等待，然后重试
      await sleep(15);
    } else if (this.#videoDecCusorIdx >= this.#videoSamples.length) {
      // decode completed
      return null;
    } else {
      // todo: 丢弃 cts < time 的 sample
      // 启动解码任务，然后重试
      let endIdx = this.#videoDecCusorIdx + 1;
      let delCnt = 0;
      for (; endIdx < this.#videoSamples.length; endIdx++) {
        // 找一个 GoP，所以是下一个关键帧结束
        const s = this.#videoSamples[endIdx];
        if (s.is_sync) break;
        if (s.deleted) delCnt += 1;
      }

      if (delCnt < endIdx - this.#videoDecCusorIdx - 1) {
        const videoGoP = this.#videoSamples
          .slice(this.#videoDecCusorIdx, endIdx)
          .map(sample2VideoChunk);
        this.#videoDecoding = true;
        let discardCnt = delCnt;
        this.#videoGoPDec?.decode(videoGoP, (vf, done) => {
          if (discardCnt > 0) {
            vf?.close();
            discardCnt -= 1;
          } else if (vf != null) {
            this.#videoFrames.push(vf);
          }
          if (done) this.#videoDecoding = false;
        });
      }
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

    if (this.#audioDecoding) {
      // 解码中，等待
      await sleep(15);
    } else if (this.#audioDecCusorIdx >= this.#audioSamples.length - 1) {
      // decode completed
      return [];
    } else {
      // 启动解码任务
      const samples = [];
      for (let i = this.#audioDecCusorIdx; i < this.#audioSamples.length; i++) {
        this.#audioDecCusorIdx = i;
        const s = this.#audioSamples[i];
        if (s.deleted) continue;
        if (samples.length > 10) break;
        samples.push(s);
      }

      this.#audioDecoding = true;
      this.#audioChunksDec.decode(
        samples.map((s) => new EncodedAudioChunk(sample2ChunkOpts(s))),
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
    const gop = findGoPSampleByTime(time, this.#videoSamples);
    let finded = false;
    let lastVf: VideoFrame | null = null;
    return new Promise<VideoFrame | null>((resolve) => {
      this.#videoGoPDec?.decode(gop.map(sample2VideoChunk), (vf, done) => {
        if (done) resolve(lastVf);
        if (vf == null) return;
        if (finded) {
          vf.close();
          return;
        }

        if (time < vf.timestamp) {
          finded = true;
          resolve(lastVf);
          return;
        }

        lastVf?.close();
        if (time >= vf.timestamp && time <= vf.timestamp + (vf.duration ?? 0)) {
          finded = true;
          resolve(vf);
        } else {
          lastVf = vf;
        }
      });
    });
  }

  deleteRange(startTime: number, endTime: number) {
    if (endTime <= startTime)
      throw Error('endTime must be greater than startTime');

    _del(this.#videoSamples, startTime, endTime);
    _del(this.#audioSamples, startTime, endTime);
    this.#meta.duration -= endTime - startTime;

    function _del(
      samples: Array<MP4Sample & { deleted?: boolean }>,
      startTime: number,
      endTime: number,
    ) {
      for (const s of samples) {
        if (s.deleted) continue;

        if (s.cts >= startTime && s.cts <= endTime) {
          s.deleted = true;
          s.cts = -1;
        } else if (s.cts > endTime) {
          s.cts -= endTime - startTime;
        }
      }
    }
  }

  thumbnails(): Promise<Array<{ ts: number; img: Blob }>> {
    const vdec = this.#videoGoPDec;
    if (vdec == null) return Promise.resolve([]);

    const { width, height } = this.#meta;
    const convtr = createVF2BlobConvtr(
      100,
      Math.round(height * (100 / width)),
      { quality: 0.1, type: 'image/png' },
    );

    return new Promise<Array<{ ts: number; img: Blob }>>((resolve) => {
      const pngPromises: Array<{ ts: number; img: Promise<Blob> }> = [];
      async function resolver() {
        resolve(
          await Promise.all(
            pngPromises.map(async (it) => ({
              ts: it.ts,
              img: await it.img,
            })),
          ),
        );
      }

      vdec.decode(
        this.#videoSamples
          .filter((s) => !s.deleted && s.is_sync)
          .map(sample2VideoChunk),
        (vf, done) => {
          if (vf == null) return;
          pngPromises.push({
            ts: vf.timestamp,
            img: convtr(vf),
          });

          if (done) resolver();
        },
      );
    });
  }

  destroy(): void {
    if (this.#destroyed) return;
    this.#log.info(
      'MP4Clip destroy, ts:',
      this.#ts,
      ', remainder frame count:',
      this.#videoFrames.length,
    );
    this.#destroyed = true;

    this.#videoFrames.forEach((f) => f.close());
    this.#videoFrames = [];
  }
}

function sample2VideoChunk(s: MP4Sample) {
  return new EncodedVideoChunk(sample2ChunkOpts(s));
}

function createVF2BlobConvtr(
  width: number,
  height: number,
  opts?: ImageEncodeOptions,
) {
  const cvs = new OffscreenCanvas(width, height);
  const ctx = cvs.getContext('2d')!;

  return async (vf: VideoFrame) => {
    ctx.drawImage(vf, 0, 0, width, height);
    const blob = await cvs.convertToBlob(opts);
    vf.close();
    return blob;
  };
}

function findGoPSampleByTime(time: number, samples: MP4Sample[]): MP4Sample[] {
  let end = -1;
  let lastSyncIdx = -1;
  let finded = false;
  for (let i = 0; i < samples.length; i++) {
    const s = samples[i];
    if (s.is_sync) {
      if (finded) {
        end = i;
        break;
      } else if (time >= s.cts) {
        lastSyncIdx = i;
      }
    }
    if (time >= s.cts && time <= s.cts + s.duration) {
      finded = true;
      if (s.is_sync) {
        end = i + 1;
        break;
      }
    }
  }
  if (lastSyncIdx === -1) return [];

  return samples.slice(lastSyncIdx, end === -1 ? samples.length : end);
}
