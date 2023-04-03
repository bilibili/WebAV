import { EventTool } from '../event-tool'
import { mediaStream2Video } from '../utils'
import { Rect } from './rect'

export abstract class BaseSprite {
  rect = new Rect()

  visible = true

  zIndex = 0

  actived = false

  flip: 'horizontal' | 'vertical' | null = null

  constructor (public name: string) {}

  render (ctx: CanvasRenderingContext2D): void {
    const { rect: { center, ctrls, angle } } = this
    ctx.setTransform(
      // 水平 缩放、倾斜
      this.flip === 'horizontal' ? -1 : 1, 0,
      // 垂直 倾斜、缩放
      0, this.flip === 'vertical' ? -1 : 1,
      // 坐标原点偏移 x y
      center.x, center.y
    )
    // 任意方向翻转，旋转角度转为负值，才能与控制点同步
    ctx.rotate((this.flip == null ? 1 : -1) * angle)

    // 绘制 ctrls
    if (!this.actived) return
    ctx.fillStyle = '#ffffff'
    Object.values(ctrls).forEach(({ x, y, w, h }) => {
      ctx.fillRect(x, y, w, h)
    })
  }

  abstract destory (): void
}

export class VideoSprite extends BaseSprite {
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
    // todo: 使用dom替代canvas绘制控制点
    super.render(ctx)
    // todo: rect and clip
    const { w, h } = this.rect
    ctx.drawImage(this.#videoEl, -w / 2, -h / 2, w, h)
    ctx.resetTransform()
  }

  destory (): void {
    this.#videoEl?.remove()
    this.#videoEl = null
  }
}

export class SpriteManager {
  #sprites: BaseSprite[] = []

  #activeSprite: BaseSprite | null = null

  #evtTool = new EventTool<{
    add: (s: BaseSprite) => void
  }>()

  on = this.#evtTool.on

  get activeSprite (): BaseSprite | null { return this.#activeSprite }
  set activeSprite (s: BaseSprite | null) {
    if (s === this.#activeSprite) return
    if (s == null) {
      if (this.#activeSprite != null) this.#activeSprite.actived = false
    } else {
      s.actived = true
    }
    this.#activeSprite = s
  }

  addSprite<S extends BaseSprite>(s: S): void {
    this.#sprites.push(s)
    this.#sprites = this.#sprites.sort((a, b) => a.zIndex - b.zIndex)
    this.#evtTool.emit('add', s)
    // todo: 动态适配canvas宽高
  }

  getSprites (): BaseSprite[] {
    return [...this.#sprites]
  }
}
