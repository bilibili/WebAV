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
  ): Promise<void> {
    super.render(ctx)
    const { w, h } = this.rect
    const { value, state } = await this.#dataSource.tick(time)
    if (state === 'done') return

    const vf = value ?? this.#lastVf
    if (vf != null) {
      ctx.drawImage(vf, -w / 2, -h / 2, w, h)
    }

    if (value != null) {
      this.#lastVf?.close()
      this.#lastVf = value
    }
  }

  destroy (): void {}
}

interface IDataSource {
  /**
   * 当前瞬间，需要的数据
   * @param time 时间，单位 微秒
   */
  tick: (time: number) => Promise<{
    value: VideoFrame | null
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
  #videoFrame: VideoFrame[] = []

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
          this.#videoFrame.push(vf)
          lastVf = vf
        },
        onAudioOutput: () => {},
        onEnded: () => {
          if (lastVf == null) throw Error('mp4 parse error, no video frame')
          this.meta.duration = lastVf.timestamp + (lastVf.duration ?? 0)
          this.#frameParseEnded = true
        }
      })
    })
  }

  #next (time: number): { frame: VideoFrame | null, nextOffset: number } {
    const rs = this.#videoFrame[0] ?? null
    if (rs == null) {
      return {
        frame: null,
        nextOffset: -1
      }
    }

    if (time < rs.timestamp) {
      return {
        frame: null,
        nextOffset: rs.timestamp
      }
    }

    this.#videoFrame.shift()
    return {
      frame: rs,
      nextOffset: this.#videoFrame[0]?.timestamp ?? -1
    }
  }

  async tick (time: number): Promise<{
    value: VideoFrame | null
    state: 'success' | 'next' | 'done'
  }> {
    if (time < this.#ts) throw Error('time not allow rollback')
    if (time >= this.meta.duration) {
      return {
        value: null,
        state: 'done'
      }
    }

    this.#ts = time
    const { frame, nextOffset } = this.#next(time)
    if (frame == null) {
      if (nextOffset === -1) {
        // 解析已完成，队列已清空
        if (this.#frameParseEnded) {
          console.log('--- worker ended ----')
          return {
            value: null,
            state: 'done'
          }
        }
        // 队列已空，等待补充 vf
        await sleep(5)
        return await this.tick(time)
      }
      // 当前 time 小于最前的 frame.timestamp，等待 time 增加
      return {
        value: null,
        state: 'next'
      }
    }

    if (time >= nextOffset) {
      // frame 过期，再取下一个
      frame?.close()
      return await this.tick(time)
    }
    // console.log(2222222, frame.timestamp, this.#videoFrame)
    return {
      value: frame,
      state: 'success'
    }
  }
}
