import { Log, EventTool, file2stream, recodemux } from '@webav/internal-utils';
import { OffscreenSprite } from './sprite/offscreen-sprite';
import { sleep } from './av-utils';
import { DEFAULT_AUDIO_CONF } from './clips';

export interface ICombinatorOpts {
  width?: number;
  height?: number;
  bitrate?: number;
  fps?: number;
  bgColor?: string;
  videoCodec?: string;
  /**
   * false 合成的视频文件中排除音轨
   */
  audio?: false;
  /**
   * 向输出的视频中写入 meta tags 数据
   */
  metaDataTags?: Record<string, string>;
  /**
   * 不安全，随时可能废弃
   */
  __unsafe_hardwareAcceleration__?: HardwarePreference;
}

let COM_ID = 0;

/**
 * 避免 VideoEncoder 队列中的 VideoFrame 过多，打爆显存
 */
async function letEncoderCalmDown(getQSize: () => number) {
  if (getQSize() > 50) {
    await sleep(15);
    await letEncoderCalmDown(getQSize);
  }
}

/**
 * 视频合成器；能添加多个 {@link OffscreenSprite}，根据它们位置、层级、时间偏移等信息，合成输出为视频文件
 * @see [视频合成](https://webav-tech.github.io/WebAV/demo/2_1-concat-video)
 * @see [视频配音](https://webav-tech.github.io/WebAV/demo/2_2-video-add-audio)
 * @example
 * const spr1 = new OffscreenSprite(
 *   new MP4Clip((await fetch('<mp4 url>')).body),
 * );
 * const spr2 = new OffscreenSprite(
 *   new AudioClip((await fetch('<audio url>')).body),
 * );
 * const com = new Combinator({ width: 1280, height: 720, });

 * await com.addSprite(spr1);
 * await com.addSprite(spr2);

 * com.output(); // => ReadableStream
 *
 */
export class Combinator {
  /**
   * 检测当前环境的兼容性
   * @param args.videoCodec 指定视频编码格式，默认 avc1.42E032
   * @param args.width 指定视频宽度，默认 1920
   * @param args.height 指定视频高度，默认 1080
   * @param args.bitrate 指定视频比特率，默认 5e6
   */
  static async isSupported(
    args: {
      videoCodec?: string;
      width?: number;
      height?: number;
      bitrate?: number;
    } = {},
  ): Promise<boolean> {
    return (
      (self.OffscreenCanvas != null &&
        self.VideoEncoder != null &&
        self.VideoDecoder != null &&
        self.VideoFrame != null &&
        self.AudioEncoder != null &&
        self.AudioDecoder != null &&
        self.AudioData != null &&
        ((
          await self.VideoEncoder.isConfigSupported({
            codec: args.videoCodec ?? 'avc1.42E032',
            width: args.width ?? 1920,
            height: args.height ?? 1080,
            bitrate: args.bitrate ?? 7e6,
          })
        ).supported ??
          false) &&
        (
          await self.AudioEncoder.isConfigSupported({
            codec: DEFAULT_AUDIO_CONF.codec,
            sampleRate: DEFAULT_AUDIO_CONF.sampleRate,
            numberOfChannels: DEFAULT_AUDIO_CONF.channelCount,
          })
        ).supported) ??
      false
    );
  }

  #log = Log.create(`id:${COM_ID++},`);

  #destroyed = false;

  #sprites: Array<OffscreenSprite & { main: boolean; expired: boolean }> = [];

  #cvs;

  #ctx;

  // 中断输出
  #stopOutput: (() => void) | null = null;

  #opts: Required<ICombinatorOpts>;

  #hasVideoTrack: boolean;

  #evtTool = new EventTool<{
    OutputProgress: (progress: number) => void;
    error: (err: Error) => void;
  }>();
  on = this.#evtTool.on;

  /**
   * 根据配置创建合成器实例
   * @param opts ICombinatorOpts
   */
  constructor(opts: ICombinatorOpts = {}) {
    const { width = 0, height = 0 } = opts;
    this.#cvs = new OffscreenCanvas(width, height);
    // this.#cvs = document.querySelector('#canvas') as HTMLCanvasElement
    const ctx = this.#cvs.getContext('2d', { alpha: false });
    if (ctx == null) throw Error('Can not create 2d offscreen context');
    this.#ctx = ctx;
    this.#opts = Object.assign(
      {
        bgColor: '#000',
        width: 0,
        height: 0,
        videoCodec: 'avc1.42E032',
        audio: true,
        bitrate: 5e6,
        fps: 30,
        metaDataTags: null,
      },
      opts,
    );

    this.#hasVideoTrack = width * height > 0;
  }

  /**
   * 添加用于合成视频的 Sprite，视频时长默认取所有素材 duration 字段的最大值
   * @param os Sprite
   * @param opts.main 如果 main 为 true，视频时长为该素材的 duration 值
   */
  async addSprite(
    os: OffscreenSprite,
    opts: { main?: boolean } = {},
  ): Promise<void> {
    const logAttrs = {
      rect: pick(['x', 'y', 'w', 'h'], os.rect),
      time: { ...os.time },
      zIndex: os.zIndex,
    };
    this.#log.info('Combinator add sprite', logAttrs);
    const newOS = await os.clone();
    this.#log.info('Combinator add sprite ready');
    this.#sprites.push(
      Object.assign(newOS, {
        main: opts.main ?? false,
        expired: false,
      }),
    );
    this.#sprites.sort((a, b) => a.zIndex - b.zIndex);
  }

  #startRecodeMux(duration: number) {
    const { fps, width, height, videoCodec, bitrate, audio, metaDataTags } =
      this.#opts;
    const recodeMuxer = recodemux({
      video: this.#hasVideoTrack
        ? {
            width,
            height,
            expectFPS: fps,
            codec: videoCodec,
            bitrate,
            __unsafe_hardwareAcceleration__:
              this.#opts.__unsafe_hardwareAcceleration__,
          }
        : null,
      audio:
        audio === false
          ? null
          : {
              codec: 'aac',
              sampleRate: DEFAULT_AUDIO_CONF.sampleRate,
              channelCount: DEFAULT_AUDIO_CONF.channelCount,
            },
      duration,
      metaDataTags: metaDataTags,
    });
    return recodeMuxer;
  }

  /**
   * 输出视频文件二进制流
   */
  output(): ReadableStream<Uint8Array> {
    if (this.#sprites.length === 0) throw Error('No sprite added');

    const mainSpr = this.#sprites.find((it) => it.main);
    // 最大时间，优先取 main sprite，不存在则取最大值
    const maxTime =
      mainSpr != null
        ? mainSpr.time.offset + mainSpr.time.duration
        : Math.max(
            ...this.#sprites.map((it) => it.time.offset + it.time.duration),
          );
    if (maxTime === Infinity) {
      throw Error(
        'Unable to determine the end time, please specify a main sprite, or limit the duration of ImgClip, AudioCli',
      );
    }
    // 主视频（main）的 videoTrack duration 值为 0
    if (maxTime === -1) {
      this.#log.warn(
        "Unable to determine the end time, process value don't update",
      );
    }

    this.#log.info(`start combinate video, maxTime:${maxTime}`);
    const remux = this.#startRecodeMux(maxTime);
    let starTime = performance.now();
    const stopReCodeMux = this.#run(remux, maxTime, {
      onProgress: (prog) => {
        this.#log.debug('OutputProgress:', prog);
        this.#evtTool.emit('OutputProgress', prog);
      },
      onEnded: async () => {
        await remux.flush();
        this.#log.info(
          '===== output ended =====, cost:',
          performance.now() - starTime,
        );
        this.#evtTool.emit('OutputProgress', 1);
        this.destroy();
      },
      onError: (err) => {
        this.#evtTool.emit('error', err);
        closeOutStream(err);
        this.destroy();
      },
    });

    this.#stopOutput = () => {
      stopReCodeMux();
      remux.close();
      closeOutStream();
    };
    const { stream, stop: closeOutStream } = file2stream(
      remux.mp4file,
      500,
      this.destroy,
    );

    return stream;
  }

  /**
   * 销毁实例，释放资源
   */
  destroy() {
    if (this.#destroyed) return;
    this.#destroyed = true;

    this.#stopOutput?.();
    this.#evtTool.destroy();
  }

  #run(
    remux: ReturnType<typeof recodemux>,
    maxTime: number,
    {
      onProgress,
      onEnded,
      onError,
    }: {
      onProgress: (prog: number) => void;
      onEnded: () => Promise<void>;
      onError: (err: Error) => void;
    },
  ): () => void {
    let progress = 0;
    const aborter = { aborted: false };
    let err: Error | null = null;

    const _run = async () => {
      const { fps, bgColor, audio: outputAudio } = this.#opts;
      const timeSlice = Math.round(1e6 / fps);

      const ctx = this.#ctx;
      const sprRender = createSpritesRender({
        ctx,
        bgColor,
        sprites: this.#sprites,
        aborter,
      });
      const encodeData = createAVEncoder({
        remux,
        ctx,
        cvs: this.#cvs,
        outputAudio,
        hasVideoTrack: this.#hasVideoTrack,
        timeSlice,
        fps,
      });

      let ts = 0;
      while (true) {
        if (err != null) return;
        if (
          aborter.aborted ||
          (maxTime === -1 ? false : ts > maxTime) ||
          this.#sprites.length === 0
        ) {
          exit();
          await onEnded();
          return;
        }
        progress = ts / maxTime;

        const { audios, mainSprDone } = await sprRender(ts);
        if (mainSprDone) {
          exit();
          await onEnded();
          return;
        }

        if (aborter.aborted) return;

        encodeData(ts, audios);

        ts += timeSlice;

        await letEncoderCalmDown(remux.getEncodeQueueSize);
      }
    };

    _run().catch((e) => {
      err = e;
      this.#log.error(e);
      exit();
      onError(e);
    });

    const outProgTimer = setInterval(() => {
      onProgress(progress);
    }, 500);

    const exit = () => {
      if (aborter.aborted) return;
      aborter.aborted = true;
      clearInterval(outProgTimer);
      this.#sprites.forEach((it) => it.destroy());
    };

    return exit;
  }
}

function createSpritesRender(opts: {
  ctx: OffscreenCanvasRenderingContext2D;
  bgColor: string;
  sprites: Array<OffscreenSprite & { main: boolean; expired: boolean }>;
  aborter: { aborted: boolean };
}) {
  const { ctx, bgColor, sprites, aborter } = opts;
  const { width, height } = ctx.canvas;
  return async (ts: number) => {
    ctx.fillStyle = bgColor;
    ctx.fillRect(0, 0, width, height);

    const audios: Float32Array[][] = [];
    let mainSprDone = false;
    for (const s of sprites) {
      if (aborter.aborted) break;
      if (ts < s.time.offset || s.expired) continue;

      ctx.save();
      const { audio, done } = await s.offscreenRender(ctx, ts - s.time.offset);
      audios.push(audio);
      ctx.restore();

      // 超过设定时间主动掐断，或资源结束
      if (
        (s.time.duration > 0 && ts > s.time.offset + s.time.duration) ||
        done
      ) {
        if (s.main) mainSprDone = true;

        s.destroy();
        s.expired = true;
      }
    }
    return {
      audios,
      mainSprDone,
    };
  };
}

function createAVEncoder(opts: {
  remux: ReturnType<typeof recodemux>;
  ctx: OffscreenCanvasRenderingContext2D;
  cvs: OffscreenCanvas;
  outputAudio?: boolean;
  hasVideoTrack: boolean;
  timeSlice: number;
  fps: number;
}) {
  const { ctx, cvs, outputAudio, remux, hasVideoTrack, timeSlice } = opts;
  const { width, height } = cvs;
  let frameCnt = 0;
  // 3s 一个 GOP
  const gopSize = Math.floor(3 * opts.fps);

  const audioTrackBuf = createAudioTrackBuf(1024);

  return (ts: number, audios: Float32Array[][]) => {
    if (outputAudio !== false) {
      for (const ad of audioTrackBuf(ts, audios)) remux.encodeAudio(ad);
    }

    if (hasVideoTrack) {
      const vf = new VideoFrame(cvs, {
        duration: timeSlice,
        timestamp: ts,
      });

      remux.encodeVideo(vf, {
        keyFrame: frameCnt % gopSize === 0,
      });
      ctx.resetTransform();
      ctx.clearRect(0, 0, width, height);

      frameCnt += 1;
    }
  };
}

/**
 * 缓冲输入的数据，转换成固定帧数的 AudioData
 * @param adFrames 一个 AudioData 实例的音频帧数
 */
export function createAudioTrackBuf(adFrames: number) {
  const adDataSize = adFrames * DEFAULT_AUDIO_CONF.channelCount;
  // pcm 数据缓存区
  const chanBuf = new Float32Array(adDataSize * 3);
  let putOffset = 0;

  let audioTs = 0;
  const adDuration = (adFrames / DEFAULT_AUDIO_CONF.sampleRate) * 1e6;

  // 缺少音频数据时占位
  const placeholderData = new Float32Array(adDataSize);

  const getAudioData = (ts: number) => {
    let readOffset = 0;
    const adCnt = Math.floor(putOffset / adDataSize);
    const rs: AudioData[] = [];
    // 从缓存区按指定帧数获取数据构造 AudioData
    for (let i = 0; i < adCnt; i++) {
      rs.push(
        new AudioData({
          timestamp: audioTs,
          numberOfChannels: DEFAULT_AUDIO_CONF.channelCount,
          numberOfFrames: adFrames,
          sampleRate: DEFAULT_AUDIO_CONF.sampleRate,
          format: 'f32',
          data: chanBuf.subarray(readOffset, readOffset + adDataSize),
        }),
      );
      readOffset += adDataSize;
      audioTs += adDuration;
    }
    chanBuf.set(chanBuf.subarray(readOffset, putOffset), 0);
    putOffset -= readOffset;

    // 已有音频数据不足，使用占位数据填充
    while (ts - audioTs > adDuration) {
      rs.push(
        new AudioData({
          timestamp: audioTs,
          numberOfChannels: DEFAULT_AUDIO_CONF.channelCount,
          numberOfFrames: adFrames,
          sampleRate: DEFAULT_AUDIO_CONF.sampleRate,
          format: 'f32',
          data: placeholderData,
        }),
      );
      audioTs += adDuration;
    }
    return rs;
  };

  return (ts: number, trackAudios: Float32Array[][]) => {
    const maxLen = Math.max(...trackAudios.map((a) => a[0]?.length ?? 0));
    for (let bufIdx = 0; bufIdx < maxLen; bufIdx++) {
      let chan0 = 0;
      let chan1 = 0;
      for (let trackIdx = 0; trackIdx < trackAudios.length; trackIdx++) {
        const _c0 = trackAudios[trackIdx][0]?.[bufIdx] ?? 0;
        // 如果是单声道 PCM，第二声道复用第一声道数据
        const _c1 = trackAudios[trackIdx][1]?.[bufIdx] ?? _c0;
        chan0 += _c0;
        chan1 += _c1;
      }
      // 合成多个素材的音频数据写入缓存区
      chanBuf[putOffset] = chan0;
      chanBuf[putOffset + 1] = chan1;
      putOffset += 2;
    }
    // 消费缓存区数据，生成 AudioData
    return getAudioData(ts);
  };
}

function pick<K extends keyof T, T extends object>(keys: K[], obj: T) {
  return keys.reduce(
    (acc, key) => {
      acc[key] = obj[key];
      return acc;
    },
    {} as Record<K, T[K]>,
  );
}
