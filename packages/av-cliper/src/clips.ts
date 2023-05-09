// 避免使用 DOM API 确保这些 Clip 能在 Worker 中运行
import { Log } from './log'
import { demuxcode, sleep } from './mp4-utils'

export interface IClip {
  /**
   * 当前瞬间，需要的数据
   * @param time 时间，单位 微秒
   */
  tick: (time: number) => Promise<{
    video?: VideoFrame | ImageBitmap
    audio: AudioData[]
    state: 'done' | 'success' | 'next'
  }>

  ready: Promise<void>

  meta: {
    // 微秒
    duration: number
    width: number
    height: number
  }

  destroy: () => void
}

export class MP4Clip implements IClip {
  #videoFrames: VideoFrame[] = []
  #audioDatas: AudioData[] = []

  #ts = 0

  ready: Promise<void>

  #frameParseEnded = false

  meta = {
    // 微秒
    duration: 0,
    width: 0,
    height: 0
  }

  constructor (
    rs: ReadableStream<Uint8Array>,
    opts: { audio: boolean } = { audio: true }
  ) {
    this.ready = new Promise(resolve => {
      let lastVf: VideoFrame | null = null
      const { seek } = demuxcode(rs, opts, {
        onReady: info => {
          const videoTrack = info.videoTracks[0]
          this.meta = {
            duration: (info.duration / info.timescale) * 1e6,
            width: videoTrack.track_width,
            height: videoTrack.track_height
          }
          resolve()
          seek(0)
        },
        onVideoOutput: vf => {
          this.#videoFrames.push(vf)
          lastVf = vf
        },
        onAudioOutput: ad => {
          this.#audioDatas.push(ad)
        },
        onEnded: () => {
          if (lastVf == null) throw Error('mp4 parse error, no video frame')
          this.meta.duration = lastVf.timestamp + (lastVf.duration ?? 0)
          this.#frameParseEnded = true
        }
      })
    })
  }

  #next (time: number): {
    video: VideoFrame | null
    audio: AudioData[]
    nextOffset: number
  } {
    const audioIdx = this.#audioDatas.findIndex(ad => ad.timestamp > time)
    let audio: AudioData[] = []
    if (audioIdx !== -1) {
      audio = this.#audioDatas.slice(0, audioIdx)
      this.#audioDatas = this.#audioDatas.slice(audioIdx)
    }

    const rs = this.#videoFrames[0] ?? null
    if (rs == null) {
      return {
        video: null,
        audio,
        nextOffset: -1
      }
    }

    if (time < rs.timestamp) {
      return {
        video: null,
        audio,
        nextOffset: rs.timestamp
      }
    }

    this.#videoFrames.shift()

    return {
      video: rs,
      audio,
      nextOffset: this.#videoFrames[0]?.timestamp ?? -1
    }
  }

  async tick (time: number): Promise<{
    video?: VideoFrame
    audio: AudioData[]
    state: 'success' | 'next' | 'done'
  }> {
    if (time < this.#ts) throw Error('time not allow rollback')
    if (time >= this.meta.duration) {
      return {
        audio: [],
        state: 'done'
      }
    }

    this.#ts = time
    const { video, audio, nextOffset } = this.#next(time)
    if (video == null) {
      if (nextOffset === -1) {
        // 解析已完成，队列已清空
        if (this.#frameParseEnded) {
          Log.info('--- worker ended ----')
          return {
            audio,
            state: 'done'
          }
        }
        // 队列已空，等待补充 vf
        await sleep(5)
        return await this.tick(time)
      }
      // 当前 time 小于最前的 frame.timestamp，等待 time 增加
      return {
        audio,
        state: 'next'
      }
    }

    if (time >= nextOffset) {
      // frame 过期，再取下一个
      video?.close()
      // 音频数据不能丢
      const { video: nV, audio: nA, state } = await this.tick(time)
      return {
        video: nV,
        audio: audio.concat(nA),
        state
      }
    }
    return {
      video,
      audio,
      state: 'success'
    }
  }

  destroy (): void {
    this.#videoFrames.forEach(f => f.close())
    this.#videoFrames = []
  }
}

export class AudioClip implements IClip {
  ready: Promise<void>

  meta = {
    // 微秒
    duration: 0,
    width: 0,
    height: 0,
    sampleRate: 48000,
    numberOfChannels: 2
  }

  #audioDatas: AudioData[] = []

  #ts = 0

  #opts

  // #audioDatas 索引开始位置，循环播放需要在 loopCount 变化时重置为 0
  #cusorIdx = 0

  // 循环播放器次数
  #loopCount = 0

  constructor (
    buf: ArrayBuffer,
    opts: OfflineAudioContextOptions & { loop?: boolean; volume?: number }
  ) {
    this.#opts = {
      loop: false,
      volume: 1,
      ...opts
    }
    const ctx = new OfflineAudioContext(opts)
    // const ctx = new AudioContext()
    this.ready = this.#init(ctx, buf)
  }

  async #init (
    ctx: OfflineAudioContext | AudioContext,
    buf: ArrayBuffer
  ): Promise<void> {
    const audioBuf = await ctx.decodeAudioData(buf)
    this.meta = {
      ...this.meta,
      duration: audioBuf.duration * 1e6,
      sampleRate: audioBuf.sampleRate,
      numberOfChannels: audioBuf.numberOfChannels
    }
    const chanBufs: Float32Array[] = []
    for (let i = 0; i < audioBuf.numberOfChannels; i += 1) {
      chanBufs.push(audioBuf.getChannelData(i))
    }
    // 10ms 一个声音分片
    const frameCnt = (1e4 / 1e6) * audioBuf.sampleRate
    let [chan0, chan1] = chanBufs
    if (chan1 == null) chan1 = chan0.slice(0)

    let tsOffset = 0
    const volume = this.#opts.volume
    while (true) {
      if (chan0.length === 0 || chan1.length === 0) break

      const cnt = chan0.length < frameCnt ? chan0.length : frameCnt
      let data = new Float32Array(cnt * 2)
      data.set(chan0.slice(0, cnt), 0)
      data.set(chan1.slice(0, cnt), cnt)

      if (volume !== 1) data = data.map(v => v * volume)

      this.#audioDatas.push(
        new AudioData({
          format: 'f32-planar',
          numberOfChannels: 2,
          numberOfFrames: cnt,
          sampleRate: audioBuf.sampleRate,
          timestamp: tsOffset,
          data
        })
      )

      chan0 = chan0.slice(cnt)
      chan1 = chan1.slice(cnt)
      tsOffset += 1e4
    }
  }

  async tick (time: number): Promise<{
    audio: AudioData[]
    state: 'success' | 'next' | 'done'
  }> {
    if (time < this.#ts) throw Error('time not allow rollback')
    if (!this.#opts.loop && time >= this.meta.duration) {
      return {
        audio: [],
        state: 'done'
      }
    }

    this.#ts = time

    const loopCount = Math.floor(time / this.meta.duration)
    if (loopCount > this.#loopCount) {
      this.#cusorIdx = 0
      this.#loopCount = loopCount
    }

    const offsetTime = time % this.meta.duration
    let endIdx = -1
    for (let i = this.#cusorIdx; i < this.#audioDatas.length; i += 1) {
      if (this.#audioDatas[i].timestamp > offsetTime) {
        endIdx = i
        break
      }
    }
    if (endIdx === -1) return { audio: [], state: 'next' }

    // todo: 内存优化
    const audio = this.#audioDatas
      .slice(this.#cusorIdx, endIdx)
      .map(ad => ad.clone())
    this.#cusorIdx = endIdx

    return { audio, state: 'success' }
  }

  destroy (): void {
    Log.info('---- audioclip destroy ----', this.#audioDatas)
    this.#audioDatas.forEach(ad => ad.close())
  }
}

export class ImgClip implements IClip {
  ready: Promise<void>

  meta = {
    // 微秒
    duration: 0,
    width: 0,
    height: 0
  }

  #img: ImageBitmap

  constructor (imgBitmap: ImageBitmap) {
    this.#img = imgBitmap
    this.meta.width = imgBitmap.width
    this.meta.height = imgBitmap.height
    this.ready = Promise.resolve()
  }

  async tick (): Promise<{
    video: ImageBitmap
    audio: []
    state: 'success'
  }> {
    return {
      video: await createImageBitmap(this.#img),
      audio: [],
      state: 'success'
    }
  }

  destroy (): void {
    this.#img.close()
  }
}
