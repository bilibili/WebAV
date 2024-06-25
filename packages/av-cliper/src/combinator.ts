import { OffscreenSprite } from './sprite/offscreen-sprite';
import { file2stream, recodemux } from './mp4-utils';
import { Log } from './log';
import { mixinPCM, sleep, throttle } from './av-utils';
import { EventTool } from './event-tool';
import { DEFAULT_AUDIO_CONF } from './clips';

interface ICombinatorOpts {
  width?: number;
  height?: number;
  bitrate?: number;
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
}

let COM_ID = 0;

let TOTAL_COM_ENCODE_QSIZE = new Map<Combinator, () => number>();
/**
 * 控制全局 encode queue size
 * 避免多个 Combinator 并行，导致显存溢出
 */
const encoderIdle = (() => {
  let totalQSize = 0;

  const updateQS = throttle(() => {
    let ts = 0;
    for (const getQSize of TOTAL_COM_ENCODE_QSIZE.values()) {
      ts += getQSize();
    }
    totalQSize = ts;
  }, 10);

  return async function encoderIdle() {
    updateQS();
    if (totalQSize > 100) {
      // VideoFrame 非常占用 GPU 显存，避免显存压力过大，稍等一下整体性能更优
      await sleep(totalQSize);
      updateQS();
      if (totalQSize < 50) return;

      await encoderIdle();
    }
  };
})();

/**
 * 视频合成器；能添加多个 {@link VisibleSprite}，根据它们位置、层级、时间偏移等信息，合成输出为视频文件
 * @see [视频合成](https://bilibili.github.io/WebAV/demo/2_1-concat-video)
 * @see [视频配音](https://bilibili.github.io/WebAV/demo/2_2-video-add-audio)
 * @example
 * const spr1 = new OffscreenSprite(
    new MP4Clip((await fetch('<mp4 url>')).body),
  );
  const spr2 = new OffscreenSprite(
    new AudioClip((await fetch('<audio url>')).body),
  );
  const com = new Combinator({ width: 1280, height: 720, });

  await com.addSprite(spr1);
  await com.addSprite(spr2);

  com.output(); // => ReadableStream
 *
 */
export class Combinator {
  /**
   * 检测当前环境的兼容性
   * @param args.videoCodec 指定视频编码格式，默认 avc1.42E032
   */
  static async isSupported(
    args = {
      videoCodec: 'avc1.42E032',
    },
  ): Promise<boolean> {
    return (
      self.OffscreenCanvas != null &&
      self.VideoEncoder != null &&
      self.VideoDecoder != null &&
      self.VideoFrame != null &&
      self.AudioEncoder != null &&
      self.AudioDecoder != null &&
      self.AudioData != null &&
      ((
        await self.VideoEncoder.isConfigSupported({
          codec: args.videoCodec,
          width: 1280,
          height: 720,
        })
      ).supported ??
        false) &&
      (
        await self.AudioEncoder.isConfigSupported({
          codec: DEFAULT_AUDIO_CONF.codec,
          sampleRate: DEFAULT_AUDIO_CONF.sampleRate,
          numberOfChannels: DEFAULT_AUDIO_CONF.channelCount,
        })
      ).supported
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
    this.#log.info('Combinator add sprite', os);
    const newOS = await os.clone();
    this.#log.info('Combinator add sprite ready', os);
    this.#sprites.push(
      Object.assign(newOS, {
        main: opts.main ?? false,
        expired: false,
      }),
    );
    this.#sprites.sort((a, b) => a.zIndex - b.zIndex);
  }

  #startRecodeMux(duration: number) {
    const { width, height, videoCodec, bitrate, audio, metaDataTags } =
      this.#opts;
    const recodeMuxer = recodemux({
      video: this.#hasVideoTrack
        ? {
            width,
            height,
            expectFPS: 30,
            codec: videoCodec,
            bitrate,
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
    TOTAL_COM_ENCODE_QSIZE.set(this, recodeMuxer.getEecodeQueueSize);
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

    TOTAL_COM_ENCODE_QSIZE.delete(this);
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
    let inputProgress = 0;
    let stoped = false;
    let err: Error | null = null;

    const _run = async () => {
      // 33ms ≈ 30FPS
      const timeSlice = 33e3;

      let frameCnt = 0;
      const { width, height } = this.#cvs;
      const ctx = this.#ctx;
      let ts = 0;
      while (true) {
        if (err != null) return;
        if (
          stoped ||
          (maxTime === -1 ? false : ts > maxTime) ||
          this.#sprites.length === 0
        ) {
          exit();
          await onEnded();
          return;
        }
        inputProgress = ts / maxTime;

        ctx.fillStyle = this.#opts.bgColor;
        ctx.fillRect(0, 0, width, height);

        const audios: Float32Array[][] = [];
        for (const s of this.#sprites) {
          if (stoped) break;
          if (ts < s.time.offset || s.expired) continue;

          ctx.save();
          const { audio, done } = await s.offscreenRender(
            ctx,
            ts - s.time.offset,
          );
          audios.push(audio);
          ctx.restore();

          // 超过设定时间主动掐断，或资源结束
          if (
            (s.time.duration > 0 && ts > s.time.offset + s.time.duration) ||
            done
          ) {
            if (s.main) {
              exit();
              await onEnded();
              return;
            }

            s.destroy();
            s.expired = true;
          }
        }

        if (stoped) return;

        if (this.#opts.audio !== false) {
          if (audios.flat().every((a) => a.length === 0)) {
            // 当前时刻无音频时，使用无声音频占位，否则会导致后续音频播放时间偏差
            remux.encodeAudio(
              createAudioPlaceholder(
                ts,
                timeSlice,
                DEFAULT_AUDIO_CONF.sampleRate,
              ),
            );
          } else {
            const data = mixinPCM(audios);
            remux.encodeAudio(
              new AudioData({
                timestamp: ts,
                numberOfChannels: DEFAULT_AUDIO_CONF.channelCount,
                numberOfFrames: data.length / DEFAULT_AUDIO_CONF.channelCount,
                sampleRate: DEFAULT_AUDIO_CONF.sampleRate,
                format: 'f32-planar',
                data,
              }),
            );
          }
        }

        if (this.#hasVideoTrack) {
          const vf = new VideoFrame(this.#cvs, {
            duration: timeSlice,
            timestamp: ts,
          });

          remux.encodeVideo(vf, {
            keyFrame: frameCnt % 150 === 0,
          });
          ctx.resetTransform();
          ctx.clearRect(0, 0, width, height);

          frameCnt += 1;
        }

        ts += timeSlice;

        await encoderIdle();
      }
    };

    _run().catch((e) => {
      err = e;
      this.#log.error(e);
      exit();
      onError(e);
    });

    // 初始 1 避免 NaN
    let maxEncodeQSize = 1;
    let outProgress = 0;
    // 避免 进度值 回退
    let lastProg = 0;
    const outProgTimer = setInterval(() => {
      const s = remux.getEecodeQueueSize();
      maxEncodeQSize = Math.max(maxEncodeQSize, s);
      outProgress = s / maxEncodeQSize;
      lastProg = Math.max(outProgress * 0.5 + inputProgress * 0.5, lastProg);
      onProgress(lastProg);
    }, 500);

    const exit = () => {
      if (stoped) return;
      stoped = true;
      clearInterval(outProgTimer);
      this.#sprites.forEach((it) => it.destroy());
    };

    return exit;
  }
}

function createAudioPlaceholder(
  ts: number,
  duration: number,
  sampleRate: number,
): AudioData {
  const frameCnt = Math.floor((sampleRate * duration) / 1e6);
  return new AudioData({
    timestamp: ts,
    numberOfChannels: DEFAULT_AUDIO_CONF.channelCount,
    numberOfFrames: frameCnt,
    sampleRate: sampleRate,
    format: 'f32-planar',
    data: new Float32Array(frameCnt * 2),
  });
}
