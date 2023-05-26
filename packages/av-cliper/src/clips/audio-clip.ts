import { extractPCM4AudioBuffer, ringSliceFloat32Array } from '../av-utils'
import { Log } from '../log'
import { DEFAULT_AUDIO_SAMPLE_RATE, IClip } from './iclip'

export class AudioClip implements IClip {
  static ctx = new AudioContext({ sampleRate: DEFAULT_AUDIO_SAMPLE_RATE })

  ready: Promise<{ width: number; height: number }>

  #meta = {
    // 微秒
    duration: 0,
    width: 0,
    height: 0,
    sampleRate: DEFAULT_AUDIO_SAMPLE_RATE,
    numberOfChannels: 2
  }

  #chan0Buf = new Float32Array()
  #chan1Buf = new Float32Array()

  // 微秒
  #ts = 0

  #frameOffset = 0

  #opts

  constructor (
    stream: ReadableStream<Uint8Array>,
    opts?: { loop?: boolean; volume?: number }
  ) {
    this.#opts = {
      loop: false,
      volume: 1,
      ...opts
    }

    this.ready = this.#init(AudioClip.ctx, stream).then(() => ({
      // audio 没有宽高，无需绘制
      width: 0,
      height: 0
    }))
  }

  async #init (
    ctx: OfflineAudioContext | AudioContext,
    stream: ReadableStream<Uint8Array>
  ): Promise<void> {
    const tStart = performance.now()
    const buf = await new Response(stream).arrayBuffer()
    const audioBuf = await ctx.decodeAudioData(buf)
    Log.info(
      'Audio clip decoded complete:',
      audioBuf,
      performance.now() - tStart
    )

    const pcm = extractPCM4AudioBuffer(audioBuf)
    this.#meta = {
      ...this.#meta,
      duration: audioBuf.duration * 1e6,
      sampleRate: audioBuf.sampleRate,
      numberOfChannels: audioBuf.numberOfChannels
    }

    this.#chan0Buf = pcm[0]
    // 单声道 转 立体声
    this.#chan1Buf = pcm[1] ?? this.#chan0Buf

    const volume = this.#opts.volume
    if (volume !== 1) {
      for (const chan of pcm)
        for (let i = 0; i < chan.length; i += 1) chan[i] *= volume
    }

    Log.info(
      'Audio clip convert to AudioData, time:',
      performance.now() - tStart
    )
  }

  async tick (time: number): Promise<{
    audio: Float32Array[]
    state: 'success' | 'done'
  }> {
    if (time < this.#ts) throw Error('time not allow rollback')
    if (!this.#opts.loop && time >= this.#meta.duration) {
      return { audio: [], state: 'done' }
    }

    const deltaTime = time - this.#ts
    this.#ts = time

    const frameCnt = Math.ceil(deltaTime * (this.#meta.sampleRate / 1e6))
    const endIdx = this.#frameOffset + frameCnt
    const audio = [
      ringSliceFloat32Array(this.#chan0Buf, this.#frameOffset, endIdx),
      ringSliceFloat32Array(this.#chan1Buf, this.#frameOffset, endIdx)
    ]
    this.#frameOffset = endIdx

    return { audio, state: 'success' }
  }

  destroy (): void {
    this.#chan0Buf = new Float32Array(0)
    this.#chan1Buf = new Float32Array(0)
    Log.info('---- audioclip destroy ----')
  }
}
