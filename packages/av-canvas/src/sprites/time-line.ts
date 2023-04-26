import { WorkerSprite } from './worker-sprite'

interface ITimeItem {
  offset: number
  duration: number
  sprite: WorkerSprite
}

export class Timeline {
  #timeItems: ITimeItem[] = []

  #ts = 0

  #cvs

  #ctx

  constructor (resolutions: { width: number, height: number }) {
    const { width, height } = resolutions
    this.#cvs = new OffscreenCanvas(width, height)
    const ctx = this.#cvs.getContext('2d')
    if (ctx == null) throw Error('Can not create 2d offscreen context')
    this.#ctx = ctx
  }

  add (sprite: WorkerSprite, opts: { offset: number, duration: number }): void {
    this.#timeItems.push({
      sprite,
      ...opts
    })
  }

  async output (): Promise<void> {
    const lastIt = this.#timeItems.at(-1)
    if (lastIt == null) throw Error('Timeline is empty')
    const maxTime = lastIt.offset + lastIt.duration

    // const timeSlice = 1000 / 30 / 1000
    while (this.#ts <= maxTime) {
      for (const it of this.#timeItems) {
        if (this.#ts < it.offset || this.#ts > it.offset + it.duration) {
          continue
        }
        await it.sprite.offscreenRender(this.#ctx, this.#ts)
      }
      const vf = new VideoFrame(this.#cvs, {
        alpha: 'discard',
        duration: 0,
        timestamp: 0
      })
      console.log('output while:', vf)
    }
  }
}
