import {
  concatPCMFragments,
  extractPCM4AudioBuffer,
  ringSliceFloat32Array,
} from '../av-utils';
import { Log } from '../log';
import { DEFAULT_AUDIO_CONF, IClip } from './iclip';

interface IAudioClipOpts {
  loop?: boolean;
  volume?: number;
}

export class AudioClip implements IClip {
  static ctx: AudioContext | null = null;

  ready: IClip['ready'];

  #meta = {
    // 微秒
    duration: 0,
    width: 0,
    height: 0,
  };

  #chan0Buf = new Float32Array();
  #chan1Buf = new Float32Array();
  getPCMData(): Float32Array[] {
    return [this.#chan0Buf, this.#chan1Buf];
  }

  #opts;

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

  // 微秒
  #ts = 0;
  #frameOffset = 0;
  /**
   * Return the audio PCM data corresponding to the difference between the last and current moments. If the difference exceeds 3 seconds or the current time is less than the previous time, reset the state.
   * CN: 返回上次与当前时刻差对应的音频 PCM 数据；若差值超过 3s 或当前时间小于上次时间，则重置状态
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

    return { audio, state: 'success' };
  }

  async clone() {
    return new AudioClip(this.getPCMData(), this.#opts) as this;
  }

  destroy(): void {
    this.#chan0Buf = new Float32Array(0);
    this.#chan1Buf = new Float32Array(0);
    Log.info('---- audioclip destroy ----');
  }
}

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
