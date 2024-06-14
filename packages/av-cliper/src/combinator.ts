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
 * 视频合成器，它能添加 {@link OffscreenSprite} 在后台快速生成视频，目前仅支持生成 MP4(AVC)格式的视频
 * @see [DEMO](https://bilibili.github.io/WebAV/demo/2_1-concat-video)
 */
export class Combinator {
  /**
   * 检测当前设备是否支持 Combinator 运行，通过检测一系列 Web API 的兼容性来判断结果，具体 API 请查看源码
   * @param conf.videoCodec 指定检测特定的视频编码格式，默认 `avc1.42E032`
   */
  static async isSupported(
    conf = {
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
          codec: conf.videoCodec,
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

  #remux;

  #opts;

  #hasVideoTrack: boolean;

  #evtTool = new EventTool<{
    OutputProgress: (progress: number) => void;
    error: (err: Error) => void;
  }>();
  on = this.#evtTool.on;

  constructor(opts: ICombinatorOpts = {}) {
    const { width = 0, height = 0 } = opts;
    this.#cvs = new OffscreenCanvas(width, height);
    // this.#cvs = document.querySelector('#canvas') as HTMLCanvasElement
    const ctx = this.#cvs.getContext('2d', { alpha: false });
    if (ctx == null) throw Error('Can not create 2d offscreen context');
    this.#ctx = ctx;
    this.#opts = Object.assign({ bgColor: '#000' }, opts);

    this.#hasVideoTrack = width * height > 0;

    this.#remux = recodemux({
      video: this.#hasVideoTrack
        ? {
            width,
            height,
            expectFPS: 30,
            codec: opts.videoCodec ?? 'avc1.42E032',
            bitrate: opts.bitrate ?? 5_000_000,
          }
        : null,
      audio:
        opts.audio === false
          ? null
          : {
              codec: 'aac',
              sampleRate: DEFAULT_AUDIO_CONF.sampleRate,
              channelCount: DEFAULT_AUDIO_CONF.channelCount,
            },
      metaDataTags: opts.metaDataTags,
    });

    TOTAL_COM_ENCODE_QSIZE.set(this, this.#remux.getEecodeQueueSize);
  }

  /**
   * 当 opts.main 为 true 的素材时间结束时会终结合并流程；
   */
  /**
   * 添加 {@link OffscreenSprite}
   * @param os OffscreenSprite
   * @param opts 当 main 为 true 对应的 OffscreenSprite 时间结束时会终止合并流程，超过该时间的内容会被丢弃
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

  /**
   * 合成 {@link Combinator.addSprite} {@link OffscreenSprite} ，输出视频文件（MP4）二进制流
   */
  output(): ReadableStream<Uint8Array> {
    if (this.#sprites.length === 0) throw Error('No clip added');

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
    let starTime = performance.now();
    const stopReCodeMux = this.#run(maxTime, {
      onProgress: (prog) => {
        this.#log.debug('OutputProgress:', prog);
        this.#evtTool.emit('OutputProgress', prog);
      },
      onEnded: async () => {
        await this.#remux.flush();
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
      this.#remux.close();
      closeOutStream();
    };
    const { stream, stop: closeOutStream } = file2stream(
      this.#remux.mp4file,
      500,
      this.destroy,
    );

    return stream;
  }

  /**
   * 销毁当前实例
   */
  destroy() {
    if (this.#destroyed) return;
    this.#destroyed = true;

    TOTAL_COM_ENCODE_QSIZE.delete(this);
    this.#stopOutput?.();
    this.#evtTool.destroy();
  }

  #run(
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
            this.#remux.encodeAudio(
              createAudioPlaceholder(
                ts,
                timeSlice,
                DEFAULT_AUDIO_CONF.sampleRate,
              ),
            );
          } else {
            const data = mixinPCM(audios);
            this.#remux.encodeAudio(
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

          this.#remux.encodeVideo(vf, {
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
      const s = this.#remux.getEecodeQueueSize();
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
