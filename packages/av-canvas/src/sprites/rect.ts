import { IPoint } from '../types'

export type TCtrlKey = 't' | 'b' | 'l' | 'r' | 'lt' | 'lb' | 'rt' | 'rb' | 'rotate'

export const CTRL_KEYS = ['t', 'b', 'l', 'r', 'lt', 'lb', 'rt', 'rb', 'rotate']

interface IRectBaseProps {
  x: number
  y: number
  w: number
  h: number
  angle: number
}

type TKeyFrameOpts = Record<`${number}%` | 'from' | 'to', Partial<IRectBaseProps>>

interface IAnimationOpts {
  duration: number
  delay?: number
  iterationCount?: number
}

export type TAnimationKeyFrame = Array<[number, Partial<IRectBaseProps>]>

export class Rect implements IRectBaseProps {
  /**
   * ctrl 节点的边长
   */
  static CTRL_SIZE = 16

  x = 0
  y = 0
  w = 0
  h = 0
  angle = 0

  /**
   * ctrl.master is sprite rect
   */
  master: Rect | null = null

  #animatKeyFrame: TAnimationKeyFrame | null = null

  #animatOpts: Required<IAnimationOpts> | null = null

  constructor (x?: number, y?: number, w?: number, h?: number, master?: Rect | null) {
    this.x = x ?? 0
    this.y = y ?? 0
    this.w = w ?? 0
    this.h = h ?? 0
    this.master = master ?? null
  }

  get center (): IPoint {
    const { x, y, w, h } = this
    return { x: x + w / 2, y: y + h / 2 }
  }

  // 上下左右+四个角+旋转控制点
  get ctrls (): Record<TCtrlKey, Rect> {
    const { w, h } = this
    // todo：控制点在高分辨率下看起来太小
    // 控制点元素大小, 以 分辨率 为基准
    const sz = Rect.CTRL_SIZE
    // half size
    const hfSz = sz / 2
    const hfW = w / 2
    const hfH = h / 2
    // rotate size
    const rtSz = sz * 1.5
    const hfRtSz = rtSz / 2
    // ctrl 坐标是相对于 sprite 中心点
    return {
      t: new Rect(-hfSz, -hfH - hfSz, sz, sz, this),
      b: new Rect(-hfSz, hfH - hfSz, sz, sz, this),
      l: new Rect(-hfW - hfSz, -hfSz, sz, sz, this),
      r: new Rect(hfW - hfSz, -hfSz, sz, sz, this),
      lt: new Rect(-hfW - hfSz, -hfH - hfSz, sz, sz, this),
      lb: new Rect(-hfW - hfSz, hfH - hfSz, sz, sz, this),
      rt: new Rect(hfW - hfSz, -hfH - hfSz, sz, sz, this),
      rb: new Rect(hfW - hfSz, hfH - hfSz, sz, sz, this),
      rotate: new Rect(-hfRtSz, -hfH - sz * 2 - hfRtSz, rtSz, rtSz, this)
    }
  }

  clone (): Rect {
    const { x, y, w, h, master } = this
    return new Rect(x, y, w, h, master)
  }

  setAnimation (keyFrame: TKeyFrameOpts, opts: IAnimationOpts): void {
    this.#animatKeyFrame = Object.entries(keyFrame)
      .map(([k, val]) => {
        const numK = ({ from: 0, to: 100 })[k] ?? Number(k.slice(0, -1))
        if (isNaN(numK) || numK > 100 || numK < 0) {
          throw Error('keyFrame must between 0~100')
        }
        return [numK / 100, val]
      })
    this.#animatOpts = Object.assign({
      duration: opts.duration * 1e6,
      delay: (opts.delay ?? 0) * 1e6,
      iterationCount: opts.iterationCount ?? Infinity
    })
  }

  animate (time: number): void {
    if (
      this.#animatKeyFrame == null ||
      this.#animatOpts == null ||
      time < this.#animatOpts.delay
    ) return
    // todo: delay, other timing-function
    Object.assign(
      this,
      linearTimeFn(time, this.#animatKeyFrame, this.#animatOpts)
    )
  }

  /**
   * 检测点击是否命中
   */
  checkHit (tx: number, ty: number): boolean {
    let { angle, center, x, y, w, h, master } = this
    // ctrls 的中心点、旋转角度都去自于 master （sprite）
    const cnt = master?.center ?? center
    const agl = master?.angle ?? angle
    // ctrl 初始化时其坐标就是相对于 master 的，参见 get ctrls()
    // 所以此处不用转换
    if (master == null) {
      x = x - cnt.x
      y = y - cnt.y
    }
    // 鼠标点击坐标映射成以中点为原点的坐标
    const tOX = tx - cnt.x
    const tOY = ty - cnt.y
    // 如果有旋转，映射成相对 sprite 原点，旋转前的坐标
    let mx = tOX
    let my = tOY
    if (agl !== 0) {
      // 推导公式 https://github.com/hughfenghen/hughfenghen.github.io/issues/96
      mx = tOX * Math.cos(agl) + tOY * Math.sin(agl)
      my = tOY * Math.cos(agl) - tOX * Math.sin(agl)
    }

    if (mx < x || mx > x + w || my < y || my > y + h) return false

    return true
  }
}

export function linearTimeFn (
  time: number,
  kf: TAnimationKeyFrame,
  opts: Required<IAnimationOpts>
): Partial<IRectBaseProps> {
  if (time / opts.duration >= opts.iterationCount) return {}

  const t = time % opts.duration

  const process = time === opts.duration ? 1 : t / opts.duration
  const idx = kf.findIndex(it => it[0] >= process)
  if (idx === -1) return {}

  const startState = kf[idx - 1]
  const nextState = kf[idx]
  const startFrame = startState[1]
  const nextFrame = nextState[1]
  if (startFrame == null) return nextFrame

  const rs: Partial<IRectBaseProps> = {}
  // 介于两个Frame状态间的进度
  const stateProcess = (process - startState[0]) / (nextState[0] - startState[0])
  for (const prop in nextFrame) {
    const p = prop as keyof IRectBaseProps
    if (startFrame[p] == null) continue
    // @ts-expect-error
    // eslint-disable-next-line
    rs[p] = (nextFrame[p] - startFrame[p]) * stateProcess + startFrame[p]
  }

  return rs
}
