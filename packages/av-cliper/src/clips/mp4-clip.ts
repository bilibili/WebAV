import { MP4Info, MP4Sample } from '@webav/mp4box.js';
import {
  audioResample,
  autoReadStream,
  extractPCM4AudioData,
  sleep,
} from '../av-utils';
import { Log } from '../log';
import { extractFileConfig } from '../mp4-utils/mp4box-utils';
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
  /**
   * 不安全，随时可能废弃
   */
  __unsafe_hardwareAcceleration__?: HardwarePreference;
}

type ExtMP4Sample = Omit<MP4Sample, 'data'> & {
  is_idr: boolean;
  deleted?: boolean;
  data: null | Uint8Array;
};

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
    opts: MP4ClipOpts = {},
  ) {
    if (
      !(source instanceof ReadableStream) &&
      !isOTFile(source) &&
      !Array.isArray(source.videoSamples)
    ) {
      throw Error('Illegal argument');
    }

    this.#opts = { audio: true, ...opts };
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
      const { videoFrameFinder, audioFrameFinder } = genDecoder(
        {
          video:
            decoderConf.video == null
              ? null
              : {
                  ...decoderConf.video,
                  hardwareAcceleration:
                    this.#opts.__unsafe_hardwareAcceleration__,
                },
          audio: decoderConf.audio,
        },
        await this.#localFile.createReader(),
        videoSamples,
        audioSamples,
        this.#opts.audio !== false ? this.#volume : 0,
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

    const [audio, video] = await Promise.all([
      this.#audioFrameFinder?.find(time) ?? [],
      this.#videoFrameFinder?.find(time),
    ]);

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

  #thumbAborter = new AbortController();
  /**
   * 生成缩略图，默认每个关键帧生成一个 100px 宽度的缩略图。
   *
   * @param imgWidth 缩略图宽度，默认 100
   * @param opts Partial<ThumbnailOpts>
   * @returns Promise<Array<{ ts: number; img: Blob }>>
   */
  async thumbnails(
    imgWidth = 100,
    opts?: Partial<ThumbnailOpts>,
  ): Promise<Array<{ ts: number; img: Blob }>> {
    this.#thumbAborter.abort();
    this.#thumbAborter = new AbortController();
    const aborterSignal = this.#thumbAborter.signal;

    await this.ready;
    const abortMsg = 'generate thumbnails aborted';
    if (aborterSignal.aborted) throw Error(abortMsg);

    const { width, height } = this.#meta;
    const convtr = createVF2BlobConvtr(
      imgWidth,
      Math.round(height * (imgWidth / width)),
      { quality: 0.1, type: 'image/png' },
    );

    return new Promise<Array<{ ts: number; img: Blob }>>(
      async (resolve, reject) => {
        let pngPromises: Array<{ ts: number; img: Promise<Blob> }> = [];
        const vc = this.#decoderConf.video;
        if (vc == null || this.#videoSamples.length === 0) {
          resolver();
          return;
        }
        aborterSignal.addEventListener('abort', () => {
          reject(Error(abortMsg));
        });

        async function resolver() {
          if (aborterSignal.aborted) return;
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
          let cur = start;
          // 创建一个新的 VideoFrameFinder 实例，避免与 tick 方法共用而导致冲突
          const videoFrameFinder = new VideoFrameFinder(
            await this.#localFile.createReader(),
            this.#videoSamples,
            {
              ...vc,
              hardwareAcceleration: this.#opts.__unsafe_hardwareAcceleration__,
            },
          );
          while (cur <= end && !aborterSignal.aborted) {
            const vf = await videoFrameFinder.find(cur);
            if (vf) pushPngPromise(vf);
            cur += step;
          }
          videoFrameFinder.destroy();
          resolver();
        } else {
          await thumbnailByKeyFrame(
            this.#videoSamples,
            this.#localFile,
            vc,
            aborterSignal,
            { start, end },
            (vf, done) => {
              if (vf != null) pushPngPromise(vf);
              if (done) resolver();
            },
          );
        }
      },
    );
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

function genDecoder(
  decoderConf: MP4DecoderConf,
  localFileReader: LocalFileReader,
  videoSamples: ExtMP4Sample[],
  audioSamples: ExtMP4Sample[],
  volume: number,
) {
  return {
    audioFrameFinder:
      volume === 0 || decoderConf.audio == null || audioSamples.length === 0
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
              videoSamples.push(normalizeTimescale(s, videoDeltaTS, 'video'));
            }
          } else if (data.type === 'audio' && opts.audio) {
            if (audioDeltaTS === -1) audioDeltaTS = data.samples[0].dts;
            for (const s of data.samples) {
              audioSamples.push(normalizeTimescale(s, audioDeltaTS, 'audio'));
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
          firstSample.duration += firstSample.cts;
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

  function normalizeTimescale(
    s: MP4Sample,
    delta = 0,
    sampleType: 'video' | 'audio',
  ) {
    return {
      ...s,
      is_idr:
        sampleType === 'video' &&
        s.is_sync &&
        isIDRFrame(s.data, s.description.type),
      cts: ((s.cts - delta) / s.timescale) * 1e6,
      dts: ((s.dts - delta) / s.timescale) * 1e6,
      duration: (s.duration / s.timescale) * 1e6,
      timescale: 1e6,
      // 音频数据量可控，直接保存在内存中
      data: sampleType === 'video' ? null : s.data,
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
  #curAborter = { abort: false, st: performance.now() };
  find = async (time: number): Promise<VideoFrame | null> => {
    if (this.#dec == null || time <= this.#ts || time - this.#ts > 3e6) {
      this.#reset(time);
    }

    this.#curAborter.abort = true;
    this.#ts = time;

    this.#curAborter = { abort: false, st: performance.now() };
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
    aborter: { abort: boolean; st: number },
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
        return await this.#parseFrame(time, dec, aborter);
      }

      if (this.#videoFrames.length < 10) {
        // 预解码 避免等待
        this.#startDecode(dec).catch((err) => {
          this.#reset(time);
          throw err;
        });
      }
      // 符合期望
      return vf;
    }

    // 缺少帧数据
    if (
      this.#decoding ||
      (this.#outputFrameCnt < this.#inputChunkCnt && dec.decodeQueueSize > 0)
    ) {
      if (performance.now() - aborter.st > 6e3) {
        throw Error(
          `MP4Clip.tick video timeout, ${JSON.stringify(this.#getState())}`,
        );
      }
      // 解码中，等待，然后重试
      await sleep(15);
    } else if (this.#videoDecCusorIdx >= this.samples.length) {
      // decode completed
      return null;
    } else {
      try {
        await this.#startDecode(dec);
      } catch (err) {
        this.#reset(time);
        throw err;
      }
    }
    return await this.#parseFrame(time, dec, aborter);
  };

  #decoding = false;
  #startDecode = async (dec: VideoDecoder) => {
    if (this.#decoding) return;
    this.#decoding = true;

    // 启动解码任务，然后重试
    let endIdx = this.#videoDecCusorIdx + 1;
    // 该 GoP 时间区间有时间匹配，且未被删除的帧
    let hasValidFrame = false;
    for (; endIdx < this.samples.length; endIdx++) {
      const s = this.samples[endIdx];
      if (!hasValidFrame && !s.deleted) {
        hasValidFrame = true;
      }
      // 找一个 GoP，所以是下一个 IDR 帧结束
      if (s.is_idr) break;
    }

    if (hasValidFrame) {
      const samples = this.samples.slice(this.#videoDecCusorIdx, endIdx);
      if (samples[0]?.is_idr !== true) {
        Log.warn('First sample not idr frame');
      } else {
        const chunks = await videosamples2Chunks(samples, this.localFileReader);
        // Wait for the previous asynchronous operation to complete, at which point the task may have already been terminated
        if (dec.state === 'closed') return;

        this.#lastVfDur = chunks[0]?.duration ?? 0;
        decodeGoP(dec, chunks, {
          onDecodingError: (err) => {
            if (this.#downgradeSoftDecode) {
              throw err;
            } else if (this.#outputFrameCnt === 0) {
              this.#downgradeSoftDecode = true;
              Log.warn('Downgrade to software decode');
              this.#reset();
            }
          },
        });

        this.#inputChunkCnt += chunks.length;
      }
    }
    this.#videoDecCusorIdx = endIdx;
    this.#decoding = false;
  };

  #reset = (time?: number) => {
    this.#decoding = false;
    this.#videoFrames.forEach((f) => f.close());
    this.#videoFrames = [];
    if (time == null || time === 0) {
      this.#videoDecCusorIdx = 0;
    } else {
      let keyIdx = 0;
      for (let i = 0; i < this.samples.length; i++) {
        const s = this.samples[i];
        if (s.is_idr) keyIdx = i;
        if (s.cts < time) continue;
        this.#videoDecCusorIdx = keyIdx;
        break;
      }
    }
    this.#inputChunkCnt = 0;
    this.#outputFrameCnt = 0;
    if (this.#dec?.state !== 'closed') this.#dec?.close();
    this.#dec = new VideoDecoder({
      output: (vf) => {
        this.#outputFrameCnt += 1;
        if (vf.timestamp === -1) {
          vf.close();
          return;
        }
        let rsVf = vf;
        if (vf.duration == null) {
          rsVf = new VideoFrame(vf, {
            duration: this.#lastVfDur,
          });
          vf.close();
        }
        this.#videoFrames.push(rsVf);
      },
      error: (err) => {
        Log.error(`MP4Clip VideoDecoder err: ${err.message}`);
      },
    });
    this.#dec.configure({
      ...this.conf,
      ...(this.#downgradeSoftDecode
        ? { hardwareAcceleration: 'prefer-software' }
        : {}),
    });
  };

  #getState = () => ({
    time: this.#ts,
    decState: this.#dec?.state,
    decQSize: this.#dec?.decodeQueueSize,
    decCusorIdx: this.#videoDecCusorIdx,
    sampleLen: this.samples.length,
    inputCnt: this.#inputChunkCnt,
    outputCnt: this.#outputFrameCnt,
    cacheFrameLen: this.#videoFrames.length,
    softDeocde: this.#downgradeSoftDecode,
  });

  destroy = () => {
    if (this.#dec?.state !== 'closed') this.#dec?.close();
    this.#dec = null;
    this.#curAborter.abort = true;
    this.#videoFrames.forEach((f) => f.close());
    this.#videoFrames = [];
    this.localFileReader.close();
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
  #curAborter = { abort: false, st: performance.now() };
  find = async (time: number): Promise<Float32Array[]> => {
    // 前后获取音频数据差异不能超过 100ms
    if (this.#dec == null || time <= this.#ts || time - this.#ts > 0.1e6) {
      this.#reset();
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

    this.#curAborter = { abort: false, st: performance.now() };
    return await this.#parseFrame(deltaTime, this.#dec, this.#curAborter);
  };

  #ts = 0;
  #decCusorIdx = 0;
  #pcmData: {
    frameCnt: number;
    data: [Float32Array, Float32Array][];
  } = {
    frameCnt: 0,
    data: [],
  };
  #parseFrame = async (
    deltaTime: number,
    dec: ReturnType<typeof createAudioChunksDecoder> | null = null,
    aborter: { abort: boolean; st: number },
  ): Promise<Float32Array[]> => {
    if (dec == null || aborter.abort || dec.state === 'closed') return [];

    const emitFrameCnt = Math.ceil(deltaTime * (this.#sampleRate / 1e6));
    if (emitFrameCnt === 0) return [];

    // 数据满足需要
    const ramainFrameCnt = this.#pcmData.frameCnt - emitFrameCnt;
    if (ramainFrameCnt > 0) {
      // 剩余音频数据小于 100ms
      if (ramainFrameCnt < DEFAULT_AUDIO_CONF.sampleRate / 10) {
        this.#startDecode(dec);
      }
      return emitAudioFrames(this.#pcmData, emitFrameCnt);
    }

    if (dec.decodeQueueSize > 10) {
      if (performance.now() - aborter.st > 3e3) {
        aborter.abort = true;
        throw Error(
          `MP4Clip.tick audio timeout, ${JSON.stringify(this.#getState())}`,
        );
      }
      // 解码中，等待
      await sleep(15);
    } else if (this.#decCusorIdx >= this.samples.length - 1) {
      // decode completed
      return [];
    } else {
      this.#startDecode(dec);
    }
    return this.#parseFrame(deltaTime, dec, aborter);
  };

  #startDecode = (dec: ReturnType<typeof createAudioChunksDecoder>) => {
    if (dec.decodeQueueSize > 100) return;
    // 启动解码任务
    const samples = [];
    let i = this.#decCusorIdx;
    while (i < this.samples.length) {
      const s = this.samples[i];
      i += 1;
      if (s.deleted) continue;
      samples.push(s);
      if (samples.length >= 10) break;
    }
    this.#decCusorIdx = i;

    dec.decode(
      samples.map(
        (s) =>
          new EncodedAudioChunk({
            type: 'key',
            timestamp: s.cts,
            duration: s.duration,
            data: s.data!,
          }),
      ),
    );
  };

  #reset = () => {
    this.#ts = 0;
    this.#decCusorIdx = 0;
    this.#pcmData = {
      frameCnt: 0,
      data: [],
    };
    this.#dec?.close();
    this.#dec = createAudioChunksDecoder(
      this.conf,
      {
        resampleRate: DEFAULT_AUDIO_CONF.sampleRate,
        volume: this.#volume,
      },
      (pcmArr) => {
        this.#pcmData.data.push(pcmArr as [Float32Array, Float32Array]);
        this.#pcmData.frameCnt += pcmArr[0].length;
      },
    );
  };

  #getState = () => ({
    time: this.#ts,
    decState: this.#dec?.state,
    decQSize: this.#dec?.decodeQueueSize,
    decCusorIdx: this.#decCusorIdx,
    sampleLen: this.samples.length,
    pcmLen: this.#pcmData.frameCnt,
  });

  destroy = () => {
    this.#dec = null;
    this.#curAborter.abort = true;
    this.#pcmData = {
      frameCnt: 0,
      data: [],
    };
    this.localFileReader.close();
  };
}

function createAudioChunksDecoder(
  decoderConf: AudioDecoderConfig,
  opts: { resampleRate: number; volume: number },
  outputCb: (pcm: Float32Array[]) => void,
) {
  const outputHandler = (pcmArr: Float32Array[]) => {
    if (pcmArr.length === 0) return;
    // 音量调节
    if (opts.volume !== 1) {
      for (const pcm of pcmArr)
        for (let i = 0; i < pcm.length; i++) pcm[i] *= opts.volume;
    }

    // 补齐双声道
    if (pcmArr.length === 1) pcmArr = [pcmArr[0], pcmArr[0]];

    outputCb(pcmArr);
  };
  const resampleQ = createPromiseQueue<Float32Array[]>(outputHandler);

  const needResample = opts.resampleRate !== decoderConf.sampleRate;
  const adec = new AudioDecoder({
    output: (ad) => {
      const pcm = extractPCM4AudioData(ad);
      if (needResample) {
        resampleQ(() =>
          audioResample(pcm, ad.sampleRate, {
            rate: opts.resampleRate,
            chanCount: ad.numberOfChannels,
          }),
        );
      } else {
        outputHandler(pcm);
      }
      ad.close();
    },
    error: (err) => {
      Log.error(`MP4Clip AudioDecoder err: ${err.message}`);
    },
  });
  adec.configure(decoderConf);

  return {
    decode(chunks: EncodedAudioChunk[]) {
      for (const chunk of chunks) adec.decode(chunk);
    },
    close() {
      if (adec.state !== 'closed') adec.close();
    },
    get state() {
      return adec.state;
    },
    get decodeQueueSize() {
      return adec.decodeQueueSize;
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

function emitAudioFrames(
  pcmData: { frameCnt: number; data: [Float32Array, Float32Array][] },
  emitCnt: number,
) {
  // todo: perf 重复利用内存空间
  const audio = [new Float32Array(emitCnt), new Float32Array(emitCnt)];
  let offset = 0;
  let i = 0;
  for (; i < pcmData.data.length; ) {
    const [chan0, chan1] = pcmData.data[i];
    if (offset + chan0.length > emitCnt) {
      const gapCnt = emitCnt - offset;
      audio[0].set(chan0.subarray(0, gapCnt), offset);
      audio[1].set(chan1.subarray(0, gapCnt), offset);
      pcmData.data[i][0] = chan0.subarray(gapCnt, chan0.length);
      pcmData.data[i][1] = chan1.subarray(gapCnt, chan1.length);
      break;
    } else {
      audio[0].set(chan0, offset);
      audio[1].set(chan1, offset);
      offset += chan0.length;
      i++;
    }
  }
  pcmData.data = pcmData.data.slice(i);
  pcmData.frameCnt -= emitCnt;
  return audio;
}

async function videosamples2Chunks(
  samples: ExtMP4Sample[],
  reader: Awaited<ReturnType<OPFSToolFile['createReader']>>,
): Promise<EncodedVideoChunk[]> {
  const first = samples[0];
  const last = samples.at(-1);
  if (last == null) return [];

  const rangSize = last.offset + last.size - first.offset;
  if (rangSize < 30e6) {
    // 单次读取数据小于 30M，就一次性读取数据，降低 IO 频次
    const data = new Uint8Array(
      await reader.read(rangSize, { at: first.offset }),
    );
    return samples.map((s) => {
      const offset = s.offset - first.offset;
      let sData = data.subarray(offset, offset + s.size);
      if (s.is_idr) sData = removeSEIForIDR(sData);
      return new EncodedVideoChunk({
        type: s.is_sync ? 'key' : 'delta',
        timestamp: s.cts,
        duration: s.duration,
        data: sData,
      });
    });
  }

  return await Promise.all(
    samples.map(async (s) => {
      let sData = await reader.read(s.size, {
        at: s.offset,
      });
      if (s.is_idr) sData = removeSEIForIDR(new Uint8Array(sData));
      return new EncodedVideoChunk({
        type: s.is_sync ? 'key' : 'delta',
        timestamp: s.cts,
        duration: s.duration,
        data: sData,
      });
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
    if (s.is_idr) {
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
    .slice(hitSample.is_idr ? gopEndIdx : gopStartIdx)
    .map((s) => ({ ...s, cts: s.cts - time }));

  for (const s of postSlice) {
    if (s.cts >= 0) break;
    // 将第一个 GoP 中前半部分标记为 deleted
    s.deleted = true;
    s.cts = -1;
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

// 兼容解码错误
function decodeGoP(
  dec: VideoDecoder,
  chunks: EncodedVideoChunk[],
  opts: {
    onDecodingError?: (err: Error) => void;
  },
) {
  let i = 0;
  if (dec.state !== 'configured') return;
  for (; i < chunks.length; i++) dec.decode(chunks[i]);

  // windows 某些设备 flush 可能不会被 resolved，所以不能 await flush
  dec.flush().catch((err) => {
    if (!(err instanceof Error)) throw err;
    if (
      err.message.includes('Decoding error') &&
      opts.onDecodingError != null
    ) {
      opts.onDecodingError(err);
      return;
    }
    // reset 中断解码器，预期会抛出 AbortedError
    if (!err.message.includes('Aborted due to close')) {
      throw err;
    }
  });
}

// 当 IDR 帧前面携带其它数据（如 SEI）可能导致解码失败
function removeSEIForIDR(u8buf: Uint8Array) {
  const dv = new DataView(u8buf.buffer, u8buf.byteOffset, u8buf.byteLength);
  if ((dv.getUint8(4) & 0x1f) === 6) {
    return u8buf.subarray(dv.getUint32(0) + 4);
  }
  return u8buf;
}

function isIDRFrame(u8Arr: Uint8Array, type: MP4Sample['description']['type']) {
  if (type !== 'avc1' && type !== 'hvc1') return false;

  const dv = new DataView(u8Arr.buffer);
  let i = 0;
  for (; i < u8Arr.byteLength - 4; ) {
    if (type === 'avc1') {
      if ((dv.getUint8(i + 4) & 0x1f) === 5) return true;
    } else if (type === 'hvc1') {
      if (((dv.getUint8(i + 4) >> 1) & 0x3f) === 20) return true;
    }
    // 跳至下一个 NALU 继续检查
    i += dv.getUint32(i) + 4;
  }
  return false;
}

async function thumbnailByKeyFrame(
  samples: ExtMP4Sample[],
  localFile: OPFSToolFile,
  decConf: VideoDecoderConfig,
  abortSingl: AbortSignal,
  time: { start: number; end: number },
  onOutput: (vf: VideoFrame | null, done: boolean) => void,
) {
  const fileReader = await localFile.createReader();

  const chunks = await videosamples2Chunks(
    samples.filter(
      (s) =>
        !s.deleted && s.is_sync && s.cts >= time.start && s.cts <= time.end,
    ),
    fileReader,
  );
  if (chunks.length === 0 || abortSingl.aborted) return;

  let outputCnt = 0;
  const dec = createVideoDec();
  decodeGoP(dec, chunks, {
    onDecodingError: (err) => {
      Log.warn('thumbnailsByKeyFrame', err);
      // 尝试降级一次
      if (outputCnt === 0) {
        decodeGoP(createVideoDec(true), chunks, {
          onDecodingError: (err) => {
            fileReader.close();
            Log.error('thumbnailsByKeyFrame retry soft deocde', err);
          },
        });
      } else {
        onOutput(null, true);
        fileReader.close();
      }
    },
  });

  function createVideoDec(downgrade = false) {
    const dec = new VideoDecoder({
      output: (vf) => {
        outputCnt += 1;
        const done = outputCnt === chunks.length;
        onOutput(vf, done);
        if (done) fileReader.close();
      },
      error: (err) => {
        Log.error(`thumbnails decoder error: ${err.message}`);
      },
    });
    abortSingl.addEventListener('abort', () => {
      fileReader.close();
      dec.close();
    });
    dec.configure({
      ...decConf,
      ...(downgrade ? { hardwareAcceleration: 'prefer-software' } : {}),
    });
    return dec;
  }
}
