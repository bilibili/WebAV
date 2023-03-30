import { mediaStream2Video } from '../utils'

class Rect {
  x = 0
  y = 0
  w = 0
  h = 0
}

abstract class BaseResource {
  rect = new Rect()

  visible = true

  zIndex = 0

  constructor (public name: string) {}

  abstract render (ctx: CanvasRenderingContext2D): void

  abstract destory (ctx: CanvasRenderingContext2D): void
}

export class VideoResource extends BaseResource {
  #videoEl: HTMLVideoElement | null = null

  constructor (name: string, source: MediaStream) {
    super(name)
    this.init(source).catch(console.error)
  }

  async init (ms: MediaStream): Promise<void> {
    this.#videoEl = await mediaStream2Video(ms)
    this.rect.w = this.#videoEl.videoWidth
    this.rect.h = this.#videoEl.videoHeight
  }

  render (ctx: CanvasRenderingContext2D): void {
    if (this.#videoEl == null) return
    // todo: rect and clip
    const { x, y, w, h } = this.rect
    ctx.drawImage(this.#videoEl, x, y, w, h)
  }

  destory (): void {
    this.#videoEl?.remove()
    this.#videoEl = null
  }
}

export class ResourceManager {
  #resList: BaseResource[] = []

  addResource<R extends BaseResource>(res: R): void {
    this.#resList.push(res)
    this.#resList = this.#resList.sort((a, b) => a.zIndex - b.zIndex)
    // todo: 动态适配宽高
  }

  getResourceList (): BaseResource[] {
    return this.#resList
  }
}
