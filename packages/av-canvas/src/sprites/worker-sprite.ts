import { BaseSprite } from './base-sprite'
import { sleep } from '../utils'
import { demuxcode } from '../mp4-utils'

export class WorkerSprite extends BaseSprite {
  #dataSource: IDataSource
  ready: Promise<void>

  #lastVf: VideoFrame | null = null

  constructor (name: string, ds: IDataSource) {
    super(name)
    this.#dataSource = ds
    this.ready = ds.ready.then(() => {
      console.log(9999999, ds.meta)
      this.rect.w = ds.meta.width
      this.rect.h = ds.meta.height
    })
  }

  async offscreenRender (
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    time: number
  ): Promise<AudioData[]> {
    super.render(ctx)
    const { w, h } = this.rect
    const { video, audio, state } = await this.#dataSource.tick(time)
    if (state === 'done') return []

    const vf = video ?? this.#lastVf
    if (vf != null) {
      ctx.drawImage(vf, -w / 2, -h / 2, w, h)
    }

    if (video != null) {
      this.#lastVf?.close()
      this.#lastVf = video
    }

    return audio
  }

  destroy (): void {}
}

interface IDataSource {
  /**
   * 当前瞬间，需要的数据
   * @param time 时间，单位 微秒
   */
  tick: (time: number) => Promise<{
    video: VideoFrame | null
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
}

export class MP4DataSource implements IDataSource {
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

  constructor (rs: ReadableStream<Uint8Array>) {
    this.ready = new Promise((resolve) => {
      let lastVf: VideoFrame | null = null
      const { seek } = demuxcode(rs, {
        onReady: (info) => {
          const videoTrack = info.videoTracks[0]
          this.meta = {
            duration: info.duration / info.timescale * 1e6,
            width: videoTrack.track_width,
            height: videoTrack.track_height
          }
          resolve()
          seek(0)
        },
        onVideoOutput: (vf) => {
          this.#videoFrames.push(vf)
          lastVf = vf
        },
        onAudioOutput: (ad) => {
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
    video: VideoFrame | null
    audio: AudioData[]
    state: 'success' | 'next' | 'done'
  }> {
    if (time < this.#ts) throw Error('time not allow rollback')
    if (time >= this.meta.duration) {
      return {
        video: null,
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
          console.log('--- worker ended ----')
          return {
            video: null,
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
        video: null,
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
    // console.log(2222222, frame.timestamp, this.#videoFrame)
    return {
      video,
      audio,
      state: 'success'
    }
  }
}
