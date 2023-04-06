import { Rect } from './rect'

export abstract class BaseSprite {
  rect = new Rect()

  visible = true

  zIndex = 0

  flip: 'horizontal' | 'vertical' | null = null

  audioNode: GainNode | null = null

  initReady = Promise.resolve()

  constructor (public name: string) {}

  render (ctx: CanvasRenderingContext2D): void {
    // todo: clip
    const { rect: { center, angle } } = this
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
  }

  abstract destory (): void
}
