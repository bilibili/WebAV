import { MP4Info, MP4Sample } from '@webav/mp4box.js';
import {
  audioResample,
  autoReadStream,
  concatPCMFragments,
  extractPCM4AudioData,
  sleep,
} from '../av-utils';
import { Log } from '../log';
import { extractFileConfig, sample2ChunkOpts } from '../mp4-utils/mp4box-utils';
import { SampleTransform } from '../mp4-utils/sample-transform';
import { DEFAULT_AUDIO_CONF, IClip } from './iclip';
import { file, tmpfile, write } from 'opfs-tools';

let CLIP_ID = 0;

type OPFSToolFile = ReturnType<typeof file>;
function isOTFile(obj: any): obj is OPFSToolFile {
  return obj.kind === 'file' && obj.createReader instanceof Function;
}

// 用于内部创建 MP4Clip 实例
type MPClipCloneArgs = Awaited<ReturnType<typeof parseMP4Stream>> & {
  localFile: OPFSToolFile;
};

interface MP4DecoderConf {
  video: VideoDecoderConfig | null;
  audio: AudioDecoderConfig | null;
}

interface MP4ClipOpts {
  audio?: boolean | { volume: number };
}

type ExtMP4Sample = Omit<MP4Sample, 'data'> & { deleted?: boolean; data: null };

type LocalFileReader = Awaited<ReturnType<OPFSToolFile['createReader']>>;

type ThumbnailOpts = {
  start: number;
  end: number;
  step: number;
};

/**
 * MP4 素材，解析 MP4 文件，使用 {@link MP4Clip.tick} 按需解码指定时间的图像帧
 *
 * 可用于实现视频抽帧、生成缩略图、视频编辑等功能
 *
 * @example
 * new MP4Clip((await fetch('<mp4 url>')).body)
 * new MP4Clip(mp4File.stream())
 *
 * @see {@link Combinator}
 * @see [AVCanvas](../../av-canvas/classes/AVCanvas.html)
 *
 * @see [解码播放视频](https://bilibili.github.io/WebAV/demo/1_1-decode-video)
 */
export class MP4Clip implements IClip {
  #log = Log.create(`MP4Clip id:${CLIP_ID++},`);

  ready: IClip['ready'];

  #destroyed = false;

  #meta = {
    // 微秒
    duration: 0,
    width: 0,
    height: 0,
    audioSampleRate: 0,
    audioChanCount: 0,
  };

  get meta() {
    return { ...this.#meta };
  }

  #localFile: OPFSToolFile;

  #volume = 1;

  #videoSamples: ExtMP4Sample[] = [];

  #audioSamples: ExtMP4Sample[] = [];

  #videoFrameFinder: VideoFrameFinder | null = null;
  #audioFrameFinder: AudioFrameFinder | null = null;

  #decoderConf: {
    video: VideoDecoderConfig | null;
    audio: AudioDecoderConfig | null;
  } = {
    video: null,
    audio: null,
  };

  #opts: MP4ClipOpts = { audio: true };

  constructor(
    source: OPFSToolFile | ReadableStream<Uint8Array> | MPClipCloneArgs,
    opts: {
      audio?: boolean | { volume: number };
    } = { audio: true },
  ) {
    if (
      !(source instanceof ReadableStream) &&
      !isOTFile(source) &&
      !Array.isArray(source.videoSamples)
    ) {
      throw Error('Illegal argument');
    }

    this.#opts = { ...opts };
    this.#volume =
      typeof opts.audio === 'object' && 'volume' in opts.audio
        ? opts.audio.volume
        : 1;

    const initByStream = async (s: ReadableStream) => {
      await write(this.#localFile, s);
      return await this.#localFile.stream();
    };

    this.#localFile = isOTFile(source)
      ? source
      : 'localFile' in source
        ? source.localFile // from clone
        : tmpfile();

    this.ready = (
      source instanceof ReadableStream
        ? initByStream(source).then((s) => parseMP4Stream(s, this.#opts))
        : isOTFile(source)
          ? source.stream().then((s) => parseMP4Stream(s, this.#opts))
          : Promise.resolve(source)
    ).then(async ({ videoSamples, audioSamples, decoderConf }) => {
      this.#videoSamples = videoSamples;
      this.#audioSamples = audioSamples;
      this.#decoderConf = decoderConf;
      const { videoFrameFinder, audioFrameFinder } = genDeocder(
        decoderConf,
        await this.#localFile.createReader(),
        videoSamples,
        audioSamples,
        this.#opts.audio !== false ? this.#volume : null,
      );
      this.#videoFrameFinder = videoFrameFinder;
      this.#audioFrameFinder = audioFrameFinder;

      this.#meta = genMeta(decoderConf, videoSamples, audioSamples);
      this.#log.info('MP4Clip meta:', this.#meta);
      return { ...this.#meta };
    });
  }

  /**
   * 拦截 {@link MP4Clip.tick} 方法返回的数据，用于对图像、音频数据二次处理
   * @param time 调用 tick 的时间
   * @param tickRet tick 返回的数据
   *
   * @see [移除视频绿幕背景](https://bilibili.github.io/WebAV/demo/3_2-chromakey-video)
   */
  tickInterceptor: <T extends Awaited<ReturnType<MP4Clip['tick']>>>(
    time: number,
    tickRet: T,
  ) => Promise<T> = async (_, tickRet) => tickRet;

  /**
   * 获取素材指定时刻的图像帧、音频数据
   * @param time 微秒
   */
  async tick(time: number): Promise<{
    video?: VideoFrame;
    audio: Float32Array[];
    state: 'success' | 'done';
  }> {
    if (time >= this.#meta.duration) {
      return await this.tickInterceptor(time, {
        audio: [],
        state: 'done',
      });
    }

    let audioReady = false;
    let videoReady = false;
    let timeoutTimer = 0;
    const [audio, video] = (await Promise.race([
      Promise.all([
        this.#audioFrameFinder?.find(time).then((rs) => {
          audioReady = true;
          return rs;
        }) ?? [],
        this.#videoFrameFinder?.find(time).then((rs) => {
          videoReady = true;
          return rs;
        }),
      ]),
      new Promise<[]>((_, reject) => {
        timeoutTimer = self.setTimeout(() => {
          if (!audioReady) this.#audioFrameFinder?.reset();
          if (!videoReady) this.#videoFrameFinder?.reset();
          reject(
            Error(
              `MP4Clip.tick timeout, ${JSON.stringify({
                videoReady,
                audioReady,
              })}`,
            ),
          );
        }, 3000);
      }),
    ])) as [Float32Array[], VideoFrame];
    clearTimeout(timeoutTimer);

    if (video == null) {
      return await this.tickInterceptor(time, {
        audio,
        state: 'success',
      });
    }

    return await this.tickInterceptor(time, {
      video,
      audio,
      state: 'success',
    });
  }

  /**
   * Generate thumbnails, default generate 100px width thumbnails by every key frame.
   *
   * @param imgWidth thumbnail width, default 100
   * @param opts Partial<ThumbnailOpts>
   * @returns Promise<Array<{ ts: number; img: Blob }>>
   */
  async thumbnails(
    imgWidth = 100,
    opts?: Partial<ThumbnailOpts>,
  ): Promise<Array<{ ts: number; img: Blob }>> {
    const vc = this.#decoderConf.video;
    const localFileReader = await this.#localFile.createReader();
    if (vc == null || localFileReader == null) return Promise.resolve([]);

    const { width, height } = this.#meta;
    const convtr = createVF2BlobConvtr(
      imgWidth,
      Math.round(height * (imgWidth / width)),
      { quality: 0.1, type: 'image/png' },
    );

    return new Promise<Array<{ ts: number; img: Blob }>>(async (resolve) => {
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

      function pushPngPromise(vf: VideoFrame) {
        pngPromises.push({
          ts: vf.timestamp,
          img: convtr(vf),
        });
      }

      const { start = 0, end = this.#meta.duration, step } = opts ?? {};
      if (step) {
        if (
          this.#decoderConf.video == null ||
          this.#videoSamples.length === 0
        ) {
          resolver();
          return;
        }
        let cur = start;
        // 创建一个新的 VideoFrameFinder 实例，避免与 tick 方法共用而导致冲突
        const videoFrameFinder = new VideoFrameFinder(
          await this.#localFile.createReader(),
          this.#videoSamples,
          this.#decoderConf.video,
        );
        while (cur <= end) {
          const vf = await videoFrameFinder.find(cur);
          if (vf) pushPngPromise(vf);
          cur += step;
        }
        resolver();
      } else {
        // only decode key frame
        const samples = await Promise.all(
          this.#videoSamples
            .filter(
              (s) => !s.deleted && s.is_sync && s.cts >= start && s.cts <= end,
            )
            .map((s) => sample2Chunk(s, EncodedVideoChunk, localFileReader)),
        );
        if (samples.length === 0) {
          resolver();
          return;
        }

        let cnt = 0;
        const dec = new VideoDecoder({
          output: (vf) => {
            cnt += 1;
            pushPngPromise(vf);
            if (cnt === samples.length) resolver();
          },
          error: Log.error,
        });
        dec.configure(vc);
        samples.forEach((c) => {
          dec.decode(c);
        });
        await dec.flush();
      }
    });
  }

  async split(time: number) {
    await this.ready;

    if (time <= 0 || time >= this.#meta.duration)
      throw Error('"time" out of bounds');

    const [preVideoSlice, postVideoSlice] = splitVideoSampleByTime(
      this.#videoSamples,
      time,
    );
    const [preAudioSlice, postAudioSlice] = splitAudioSampleByTime(
      this.#audioSamples,
      time,
    );
    const preClip = new MP4Clip(
      {
        localFile: this.#localFile,
        videoSamples: preVideoSlice ?? [],
        audioSamples: preAudioSlice ?? [],
        decoderConf: this.#decoderConf,
      },
      this.#opts,
    );
    const postClip = new MP4Clip(
      {
        localFile: this.#localFile,
        videoSamples: postVideoSlice ?? [],
        audioSamples: postAudioSlice ?? [],
        decoderConf: this.#decoderConf,
      },
      this.#opts,
    );
    await Promise.all([preClip.ready, postClip.ready]);

    return [preClip, postClip] as [this, this];
  }

  async clone() {
    await this.ready;
    const clip = new MP4Clip(
      {
        localFile: this.#localFile,
        videoSamples: [...this.#videoSamples],
        audioSamples: [...this.#audioSamples],
        decoderConf: this.#decoderConf,
      },
      this.#opts,
    );
    await clip.ready;
    clip.tickInterceptor = this.tickInterceptor;
    return clip as this;
  }

  /**
   * 拆分 MP4Clip 为仅包含视频轨道和音频轨道的 MP4Clip
   * @returns Mp4CLip[]
   */
  async splitTrack() {
    await this.ready;
    const clips: MP4Clip[] = [];
    if (this.#videoSamples.length > 0) {
      const videoClip = new MP4Clip(
        {
          localFile: this.#localFile,
          videoSamples: [...this.#videoSamples],
          audioSamples: [],
          decoderConf: {
            video: this.#decoderConf.video,
            audio: null,
          },
        },
        this.#opts,
      );
      await videoClip.ready;
      videoClip.tickInterceptor = this.tickInterceptor;
      clips.push(videoClip);
    }
    if (this.#audioSamples.length > 0) {
      const audioClip = new MP4Clip(
        {
          localFile: this.#localFile,
          videoSamples: [],
          audioSamples: [...this.#audioSamples],
          decoderConf: {
            audio: this.#decoderConf.audio,
            video: null,
          },
        },
        this.#opts,
      );
      await audioClip.ready;
      audioClip.tickInterceptor = this.tickInterceptor;
      clips.push(audioClip);
    }

    return clips;
  }

  destroy(): void {
    if (this.#destroyed) return;
    this.#log.info('MP4Clip destroy');
    this.#destroyed = true;

    this.#videoFrameFinder?.destroy();
    this.#audioFrameFinder?.destroy();
  }
}

function genMeta(
  decoderConf: MP4DecoderConf,
  videoSamples: ExtMP4Sample[],
  audioSamples: ExtMP4Sample[],
) {
  const meta = {
    duration: 0,
    width: 0,
    height: 0,
    audioSampleRate: 0,
    audioChanCount: 0,
  };
  if (decoderConf.video != null && videoSamples.length > 0) {
    meta.width = decoderConf.video.codedWidth ?? 0;
    meta.height = decoderConf.video.codedHeight ?? 0;
  }
  if (decoderConf.audio != null && audioSamples.length > 0) {
    meta.audioSampleRate = DEFAULT_AUDIO_CONF.sampleRate;
    meta.audioChanCount = DEFAULT_AUDIO_CONF.channelCount;
  }

  let vDuration = 0;
  let aDuration = 0;
  if (videoSamples.length > 0) {
    for (let i = videoSamples.length - 1; i >= 0; i--) {
      const s = videoSamples[i];
      if (s.deleted) continue;
      vDuration = s.cts + s.duration;
      break;
    }
  }
  if (audioSamples.length > 0) {
    const lastSampele = audioSamples.at(-1)!;
    aDuration = lastSampele.cts + lastSampele.duration;
  }
  meta.duration = Math.max(vDuration, aDuration);

  return meta;
}

function genDeocder(
  decoderConf: MP4DecoderConf,
  localFileReader: LocalFileReader,
  videoSamples: ExtMP4Sample[],
  audioSamples: ExtMP4Sample[],
  volume: number | null,
) {
  return {
    audioFrameFinder:
      volume == null || decoderConf.audio == null || audioSamples.length === 0
        ? null
        : new AudioFrameFinder(
            localFileReader,
            audioSamples,
            decoderConf.audio,
            {
              volume,
              targetSampleRate: DEFAULT_AUDIO_CONF.sampleRate,
            },
          ),
    videoFrameFinder:
      decoderConf.video == null || videoSamples.length === 0
        ? null
        : new VideoFrameFinder(
            localFileReader,
            videoSamples,
            decoderConf.video,
          ),
  };
}

async function parseMP4Stream(
  source: ReadableStream<Uint8Array>,
  opts: MP4ClipOpts = {},
) {
  let mp4Info: MP4Info;
  const decoderConf: MP4DecoderConf = { video: null, audio: null };
  let videoSamples: ExtMP4Sample[] = [];
  let audioSamples: ExtMP4Sample[] = [];

  return new Promise<{
    videoSamples: typeof videoSamples;
    audioSamples: typeof audioSamples;
    decoderConf: typeof decoderConf;
  }>(async (resolve, reject) => {
    let videoDeltaTS = -1;
    let audioDeltaTS = -1;
    const stopRead = autoReadStream(source.pipeThrough(new SampleTransform()), {
      onChunk: async ({ chunkType, data }) => {
        if (chunkType === 'ready') {
          // mp4File = data.file;
          mp4Info = data.info;
          let { videoDecoderConf: vc, audioDecoderConf: ac } =
            extractFileConfig(data.file, data.info);
          decoderConf.video = vc ?? null;
          decoderConf.audio = ac ?? null;
          if (vc == null && ac == null) {
            stopRead();
            reject(
              Error('MP4Clip must contain at least one video or audio track'),
            );
          }
          Log.info(
            'mp4BoxFile moov ready',
            {
              ...data.info,
              tracks: null,
              videoTracks: null,
              audioTracks: null,
            },
            decoderConf,
          );
        } else if (chunkType === 'samples') {
          if (data.type === 'video') {
            if (videoDeltaTS === -1) videoDeltaTS = data.samples[0].dts;
            for (const s of data.samples) {
              videoSamples.push(normalizeTimescale(s, videoDeltaTS));
            }
          } else if (data.type === 'audio' && opts.audio) {
            if (audioDeltaTS === -1) audioDeltaTS = data.samples[0].dts;
            for (const s of data.samples) {
              audioSamples.push(normalizeTimescale(s, audioDeltaTS));
            }
          }
        }
      },
      onDone: () => {
        const lastSampele = videoSamples.at(-1) ?? audioSamples.at(-1);
        if (mp4Info == null) {
          reject(Error('MP4Clip stream is done, but not emit ready'));
          return;
        } else if (lastSampele == null) {
          reject(Error('MP4Clip stream not contain any sample'));
          return;
        }
        // 修复首帧黑帧
        const firstSample = videoSamples[0];
        if (firstSample != null && firstSample.cts < 200e3) {
          firstSample.cts = 0;
        }
        Log.info('mp4 stream parsed');
        resolve({
          videoSamples,
          audioSamples,
          decoderConf,
        });
      },
    });
  });

  function normalizeTimescale(s: MP4Sample, delta = 0) {
    return {
      ...s,
      cts: ((s.cts - delta) / s.timescale) * 1e6,
      dts: ((s.dts - delta) / s.timescale) * 1e6,
      duration: (s.duration / s.timescale) * 1e6,
      timescale: 1e6,
      data: null,
    };
  }
}

class VideoFrameFinder {
  #dec: VideoDecoder | null = null;
  constructor(
    public localFileReader: LocalFileReader,
    public samples: ExtMP4Sample[],
    public conf: VideoDecoderConfig,
  ) {}

  #ts = 0;
  #curAborter = { abort: false };
  find = async (time: number): Promise<VideoFrame | null> => {
    if (this.#dec == null || time <= this.#ts || time - this.#ts > 3e6) {
      this.reset();
    }

    this.#curAborter.abort = true;
    this.#ts = time;

    this.#curAborter = { abort: false };
    return await this.#parseFrame(time, this.#dec, this.#curAborter);
  };

  // fix VideoFrame duration is null
  #lastVfDur = 0;

  #downgradeSoftDecode = false;
  #videoDecCusorIdx = 0;
  #videoFrames: VideoFrame[] = [];
  #outputFrameCnt = 0;
  #inputChunkCnt = 0;
  #parseFrame = async (
    time: number,
    dec: VideoDecoder | null,
    aborter: { abort: boolean },
  ): Promise<VideoFrame | null> => {
    if (dec == null || dec.state === 'closed' || aborter.abort) return null;

    if (this.#videoFrames.length > 0) {
      const vf = this.#videoFrames[0];
      if (time < vf.timestamp) return null;
      // 弹出第一帧
      this.#videoFrames.shift();
      // 第一帧过期，找下一帧
      if (time > vf.timestamp + (vf.duration ?? 0)) {
        vf.close();
        return this.#parseFrame(time, dec, aborter);
      }
      // 符合期望
      return vf;
    }

    // 缺少帧数据
    if (this.#outputFrameCnt < this.#inputChunkCnt && dec.decodeQueueSize > 0) {
      // 解码中，等待，然后重试
      await sleep(15);
    } else if (this.#videoDecCusorIdx >= this.samples.length) {
      // decode completed
      return null;
    } else {
      // 启动解码任务，然后重试
      let endIdx = this.#videoDecCusorIdx + 1;
      // 该 GoP 时间区间有时间匹配，且未被删除的帧
      let hasValidFrame = false;
      for (; endIdx < this.samples.length; endIdx++) {
        const s = this.samples[endIdx];
        if (!hasValidFrame && !s.deleted && time < s.cts + s.duration) {
          hasValidFrame = true;
        }
        // 找一个 GoP，所以是下一个关键帧结束
        if (s.is_sync) break;
      }

      if (hasValidFrame) {
        const samples = this.samples.slice(this.#videoDecCusorIdx, endIdx);
        if (samples[0]?.is_sync !== true) {
          Log.warn('First sample not key frame');
        } else {
          const chunks = await Promise.all(
            samples.map((s) =>
              sample2Chunk(s, EncodedVideoChunk, this.localFileReader),
            ),
          );
          // Wait for the previous asynchronous operation to complete, at which point the task may have already been terminated
          if (aborter.abort) return null;

          this.#lastVfDur = chunks[0]?.duration ?? 0;
          for (const c of chunks) dec.decode(c);
          this.#inputChunkCnt += chunks.length;
          // windows 设备 flush 可能不会被 resolved
          dec.flush().catch((err) => {
            if (!(err instanceof Error)) throw err;
            if (err.message.includes('Decoding error')) {
              if (this.#downgradeSoftDecode) {
                throw err;
              } else {
                this.#downgradeSoftDecode = true;
                this.reset();
              }
            }
            // reset 中断的解码器，预期会抛出 AbortedError
            if (!err.message.includes('Aborted due to close')) {
              throw err;
            }
            Log.warn('Downgrade to software decode');
          });
        }
      }
      this.#videoDecCusorIdx = endIdx;
    }
    return this.#parseFrame(time, dec, aborter);
  };

  reset = () => {
    this.#videoFrames.forEach((f) => f.close());
    this.#videoFrames = [];
    this.#videoDecCusorIdx = 0;
    this.#inputChunkCnt = 0;
    this.#outputFrameCnt = 0;
    if (this.#dec?.state !== 'closed') this.#dec?.close();
    this.#dec = new VideoDecoder({
      output: (vf) => {
        let rsVf = vf;
        if (vf.duration == null) {
          rsVf = new VideoFrame(vf, {
            duration: this.#lastVfDur,
          });
          vf.close();
        }
        this.#outputFrameCnt += 1;
        this.#videoFrames.push(rsVf);
      },
      error: Log.error,
    });
    this.#dec.configure({
      ...this.conf,
      ...(this.#downgradeSoftDecode
        ? { hardwareAcceleration: 'prefer-software' }
        : {}),
    });
  };

  destroy = () => {
    if (this.#dec?.state !== 'closed') this.#dec?.close();
    this.#dec = null;
    this.#curAborter.abort = true;
    this.#videoFrames.forEach((f) => f.close());
    this.#videoFrames = [];
  };
}

class AudioFrameFinder {
  #volume = 1;
  #sampleRate;
  constructor(
    public localFileReader: LocalFileReader,
    public samples: ExtMP4Sample[],
    public conf: AudioDecoderConfig,
    opts: { volume: number; targetSampleRate: number },
  ) {
    this.#volume = opts.volume;
    this.#sampleRate = opts.targetSampleRate;
  }

  #dec: ReturnType<typeof createAudioChunksDecoder> | null = null;
  #curAborter = { abort: false };
  find = async (time: number): Promise<Float32Array[]> => {
    // 前后获取音频数据差异不能超过 100ms
    if (this.#dec == null || time <= this.#ts || time - this.#ts > 0.1e6) {
      this.reset();
      this.#ts = time;
      for (let i = 0; i < this.samples.length; i++) {
        if (this.samples[i].cts < time) continue;
        this.#decCusorIdx = i;
        break;
      }
      return [];
    }

    this.#curAborter.abort = true;
    const deltaTime = time - this.#ts;
    this.#ts = time;

    this.#curAborter = { abort: false };
    return await this.#parseFrame(deltaTime, this.#dec, this.#curAborter);
  };

  #ts = 0;
  #decCusorIdx = 0;
  #decoding = false;
  #pcmData: [Float32Array, Float32Array] = [
    new Float32Array(0), // left chan
    new Float32Array(0), // right chan
  ];
  #parseFrame = async (
    deltaTime: number,
    dec: ReturnType<typeof createAudioChunksDecoder> | null = null,
    aborter: { abort: boolean },
  ): Promise<Float32Array[]> => {
    if (dec == null || aborter.abort) return [];

    const frameCnt = Math.ceil(deltaTime * (this.#sampleRate / 1e6));
    if (frameCnt === 0) return [];

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

    if (this.#decoding) {
      // 解码中，等待
      await sleep(15);
    } else if (this.#decCusorIdx >= this.samples.length - 1) {
      // decode completed
      return [];
    } else {
      // 启动解码任务
      const samples = [];
      for (let i = this.#decCusorIdx; i < this.samples.length; i++) {
        this.#decCusorIdx = i;
        const s = this.samples[i];
        if (s.deleted) continue;
        if (samples.length >= 10) break;
        samples.push(s);
      }

      this.#decoding = true;
      dec.decode(
        await Promise.all(
          samples.map((s) =>
            sample2Chunk(s, EncodedAudioChunk, this.localFileReader),
          ),
        ),
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
          if (done) this.#decoding = false;
        },
      );
    }
    return this.#parseFrame(deltaTime, dec, aborter);
  };

  reset = () => {
    this.#ts = 0;
    this.#decCusorIdx = 0;
    this.#pcmData = [
      new Float32Array(0), // left chan
      new Float32Array(0), // right chan
    ];
    this.#dec?.close();
    this.#dec = createAudioChunksDecoder(
      this.conf,
      DEFAULT_AUDIO_CONF.sampleRate,
    );
  };

  destroy = () => {
    this.#dec = null;
    this.#curAborter.abort = true;
    this.#pcmData = [
      new Float32Array(0), // left chan
      new Float32Array(0), // right chan
    ];
  };
}

function createAudioChunksDecoder(
  decoderConf: AudioDecoderConfig,
  resampleRate: number,
) {
  type OutputHandle = (pcm: Float32Array[], done: boolean) => void;

  let curCb: ((pcm: Float32Array[], done: boolean) => void) | null = null;
  const needResample = resampleRate !== decoderConf.sampleRate;
  const resampleQ = createPromiseQueue<[Float32Array[], boolean]>(
    ([resampedPCM, done]) => {
      curCb?.(resampedPCM, done);
    },
  );

  const adec = new AudioDecoder({
    output: (ad) => {
      const pcm = extractPCM4AudioData(ad);
      const done = adec.decodeQueueSize === 0;
      if (needResample) {
        resampleQ(async () => [
          await audioResample(pcm, ad.sampleRate, {
            rate: resampleRate,
            chanCount: ad.numberOfChannels,
          }),
          done,
        ]);
      } else {
        curCb?.(pcm, done);
      }
      ad.close();
    },
    error: Log.error,
  });
  adec.configure(decoderConf);

  let tasks: Array<{ chunks: EncodedAudioChunk[]; cb: OutputHandle }> = [];
  async function run() {
    if (curCb != null) return;

    const t = tasks.shift();
    if (t == null) return;
    if (t.chunks.length <= 0) {
      t.cb([], true);
      run().catch(Log.error);
      return;
    }

    curCb = (pcm, done) => {
      t.cb(pcm, done);
      if (done) {
        curCb = null;
        run().catch(Log.error);
      }
    };
    for (const chunk of t.chunks) adec.decode(chunk);
  }

  return {
    decode(chunks: EncodedAudioChunk[], cb: OutputHandle) {
      tasks.push({ chunks, cb });
      run().catch(Log.error);
    },
    close() {
      curCb = null;
      if (adec.state !== 'closed') adec.close();
    },
  };
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

type Constructor<T> = {
  new (...args: any[]): T;
};

async function sample2Chunk<T extends EncodedAudioChunk | EncodedVideoChunk>(
  s: ExtMP4Sample,
  clazz: Constructor<T>,
  reader: Awaited<ReturnType<OPFSToolFile['createReader']>>,
): Promise<T> {
  const data = await reader.read(s.size, { at: s.offset });
  return new clazz(
    sample2ChunkOpts({
      ...s,
      data,
    }),
  );
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
    vf.close();
    const blob = await cvs.convertToBlob(opts);
    return blob;
  };
}

function splitVideoSampleByTime(videoSamples: ExtMP4Sample[], time: number) {
  if (videoSamples.length === 0) return [];
  let gopStartIdx = 0;
  let gopEndIdx = 0;
  let hitIdx = -1;
  for (let i = 0; i < videoSamples.length; i++) {
    const s = videoSamples[i];
    if (hitIdx === -1 && time < s.cts) hitIdx = i - 1;
    if (s.is_sync) {
      if (hitIdx === -1) {
        gopStartIdx = i;
      } else {
        gopEndIdx = i;
        break;
      }
    }
  }

  const hitSample = videoSamples[hitIdx];
  if (hitSample == null) throw Error('Not found video sample by time');

  const preSlice = videoSamples
    .slice(0, gopEndIdx === 0 ? videoSamples.length : gopEndIdx)
    .map((s) => ({ ...s }));
  for (let i = gopStartIdx; i < preSlice.length; i++) {
    const s = preSlice[i];
    if (time < s.cts) {
      s.deleted = true;
      s.cts = -1;
    }
  }

  const postSlice = videoSamples
    .slice(hitSample.is_sync ? gopEndIdx : gopStartIdx)
    .map((s) => ({ ...s, cts: s.cts - time }));
  for (let i = 0; i < gopEndIdx - gopEndIdx; i++) {
    const s = preSlice[i];
    if (s.cts < 0) {
      s.deleted = true;
      s.cts = -1;
    }
  }

  return [preSlice, postSlice];
}

function splitAudioSampleByTime(audioSamples: ExtMP4Sample[], time: number) {
  if (audioSamples.length === 0) return [];
  let hitIdx = -1;
  for (let i = 0; i < audioSamples.length; i++) {
    const s = audioSamples[i];
    if (time > s.cts) continue;
    hitIdx = i;
    break;
  }
  if (hitIdx === -1) throw Error('Not found audio sample by time');
  const preSlice = audioSamples.slice(0, hitIdx);
  const postSlice = audioSamples
    .slice(hitIdx)
    .map((s) => ({ ...s, cts: s.cts - time }));
  return [preSlice, postSlice];
}
