import {
  concatPCMFragments,
  extractPCM4AudioBuffer,
  ringSliceFloat32Array,
} from '../av-utils';
import { Log } from '@webav/internal-utils';
import { DEFAULT_AUDIO_CONF, IClip } from './iclip';

interface IAudioClipOpts {
  loop?: boolean;
  volume?: number;
}

/**
 * 音频素材，为创建、编辑音视频功能提供音频数据
 *
 * @example
 * new AudioClip((await fetch('<mp3 url>')).body, {
 *   loop: true,
 * }),
 */
export class AudioClip implements IClip {
  static ctx: AudioContext | null = null;

  ready: IClip['ready'];

  #meta = {
    // 微秒
    duration: 0,
    width: 0,
    height: 0,
  };

  /**
   * 音频元信息
   *
   * ⚠️ 注意，这里是转换后（标准化）的元信息，非原始音频元信息
   */
  get meta() {
    return {
      ...this.#meta,
      sampleRate: DEFAULT_AUDIO_CONF.sampleRate,
      chanCount: 2,
    };
  }

  #chan0Buf = new Float32Array();
  #chan1Buf = new Float32Array();
  /**
   * 获取音频素材完整的 PCM 数据
   */
  getPCMData(): Float32Array[] {
    return [this.#chan0Buf, this.#chan1Buf];
  }

  #opts;

  /**
   *
   * @param dataSource 音频文件流
   * @param opts 音频配置，控制音量、是否循环
   */
  constructor(
    dataSource: ReadableStream<Uint8Array> | Float32Array[],
    opts: IAudioClipOpts = {},
  ) {
    this.#opts = {
      loop: false,
      volume: 1,
      ...opts,
    };

    this.ready = this.#init(dataSource).then(() => ({
      // audio 没有宽高，无需绘制
      width: 0,
      height: 0,
      duration: opts.loop ? Infinity : this.#meta.duration,
    }));
  }

  async #init(
    dataSource: ReadableStream<Uint8Array> | Float32Array[],
  ): Promise<void> {
    if (AudioClip.ctx == null) {
      AudioClip.ctx = new AudioContext({
        sampleRate: DEFAULT_AUDIO_CONF.sampleRate,
      });
    }

    const tStart = performance.now();
    const pcm =
      dataSource instanceof ReadableStream
        ? await parseStream2PCM(dataSource, AudioClip.ctx)
        : dataSource;

    Log.info('Audio clip decoded complete:', performance.now() - tStart);

    const volume = this.#opts.volume;
    if (volume !== 1) {
      for (const chan of pcm)
        for (let i = 0; i < chan.length; i += 1) chan[i] *= volume;
    }

    this.#meta.duration = (pcm[0].length / DEFAULT_AUDIO_CONF.sampleRate) * 1e6;

    this.#chan0Buf = pcm[0];
    // 单声道 转 立体声
    this.#chan1Buf = pcm[1] ?? this.#chan0Buf;

    Log.info(
      'Audio clip convert to AudioData, time:',
      performance.now() - tStart,
    );
  }

  /**
   * 拦截 {@link AudioClip.tick} 方法返回的数据，用于对音频数据二次处理
   * @param time 调用 tick 的时间
   * @param tickRet tick 返回的数据
   *
   * @see [移除视频绿幕背景](https://bilibili.github.io/WebAV/demo/3_2-chromakey-video)
   */
  tickInterceptor: <T extends Awaited<ReturnType<AudioClip['tick']>>>(
    time: number,
    tickRet: T,
  ) => Promise<T> = async (_, tickRet) => tickRet;

  // 微秒
  #ts = 0;
  #frameOffset = 0;
  /**
   * 返回上次与当前时刻差对应的音频 PCM 数据；
   *
   * 若差值超过 3s 或当前时间小于上次时间，则重置状态
   * @example
   * tick(0) // => []
   * tick(1e6) // => [leftChanPCM(1s), rightChanPCM(1s)]
   *
   */
  async tick(time: number): Promise<{
    audio: Float32Array[];
    state: 'success' | 'done';
  }> {
    if (!this.#opts.loop && time >= this.#meta.duration) {
      // 待观察：如果time跨度较大，返回done，理论上会丢失一些音频帧
      return { audio: [], state: 'done' };
    }

    const deltaTime = time - this.#ts;

    // reset
    if (time < this.#ts || deltaTime > 3e6) {
      this.#ts = time;
      this.#frameOffset = Math.ceil(
        (this.#ts / 1e6) * DEFAULT_AUDIO_CONF.sampleRate,
      );
      return {
        audio: [new Float32Array(0), new Float32Array(0)],
        state: 'success',
      };
    }

    this.#ts = time;
    const frameCnt = Math.ceil(
      (deltaTime / 1e6) * DEFAULT_AUDIO_CONF.sampleRate,
    );
    const endIdx = this.#frameOffset + frameCnt;
    const audio = this.#opts.loop
      ? [
          ringSliceFloat32Array(this.#chan0Buf, this.#frameOffset, endIdx),
          ringSliceFloat32Array(this.#chan1Buf, this.#frameOffset, endIdx),
        ]
      : [
          this.#chan0Buf.slice(this.#frameOffset, endIdx),
          this.#chan1Buf.slice(this.#frameOffset, endIdx),
        ];
    this.#frameOffset = endIdx;

    return await this.tickInterceptor(time, { audio, state: 'success' });
  }

  /**
   * 按指定时间切割，返回前后两个音频素材
   * @param time 时间，单位微秒
   */
  async split(time: number) {
    await this.ready;
    const frameCnt = Math.ceil((time / 1e6) * DEFAULT_AUDIO_CONF.sampleRate);
    const preSlice = new AudioClip(
      this.getPCMData().map((chan) => chan.slice(0, frameCnt)),
      this.#opts,
    );
    const postSlice = new AudioClip(
      this.getPCMData().map((chan) => chan.slice(frameCnt)),
      this.#opts,
    );
    return [preSlice, postSlice] as [this, this];
  }

  async clone() {
    await this.ready;
    const clip = new AudioClip(this.getPCMData(), this.#opts) as this;
    await clip.ready;
    return clip;
  }

  /**
   * 销毁实例，释放资源
   */
  destroy(): void {
    this.#chan0Buf = new Float32Array(0);
    this.#chan1Buf = new Float32Array(0);
    Log.info('---- audioclip destroy ----');
  }
}

/**
 * 拼接多个 AudioClip
 */
export async function concatAudioClip(
  clips: AudioClip[],
  opts?: IAudioClipOpts,
) {
  const bufs: Float32Array[][] = [];
  for (const clip of clips) {
    await clip.ready;
    bufs.push(clip.getPCMData());
  }
  return new AudioClip(concatPCMFragments(bufs), opts);
}

async function parseStream2PCM(
  stream: ReadableStream<Uint8Array>,
  ctx: AudioContext | OfflineAudioContext,
): Promise<Float32Array[]> {
  const buf = await new Response(stream).arrayBuffer();
  return extractPCM4AudioBuffer(await ctx.decodeAudioData(buf));
}
