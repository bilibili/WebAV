import { IRectBaseProps, Rect } from './rect';

interface IAnimationOpts {
  duration: number;
  delay?: number;
  iterCount?: number;
}

type TAnimateProps = IRectBaseProps & { opacity: number };

export type TAnimationKeyFrame = Array<[number, Partial<TAnimateProps>]>;

type TKeyFrameOpts = Partial<
  Record<`${number}%` | 'from' | 'to', Partial<TAnimateProps>>
>;

export abstract class BaseSprite {
  rect = new Rect();

  visible = true;

  zIndex = 0;

  opacity = 1;

  flip: 'horizontal' | 'vertical' | null = null;

  #animatKeyFrame: TAnimationKeyFrame | null = null;

  #animatOpts: Required<IAnimationOpts> | null = null;

  audioNode: GainNode | null = null;

  initReady = Promise.resolve();

  constructor(public name: string) {}

  render(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
  ): void {
    const {
      rect: { center, angle },
    } = this;
    ctx.setTransform(
      // 水平 缩放、倾斜
      this.flip === 'horizontal' ? -1 : 1,
      0,
      // 垂直 倾斜、缩放
      0,
      this.flip === 'vertical' ? -1 : 1,
      // 坐标原点偏移 x y
      center.x,
      center.y,
    );
    // 任意方向翻转，旋转角度转为负值，才能与控制点同步
    ctx.rotate((this.flip == null ? 1 : -1) * angle);

    ctx.globalAlpha = this.opacity;
  }

  setAnimation(keyFrame: TKeyFrameOpts, opts: IAnimationOpts): void {
    this.#animatKeyFrame = Object.entries(keyFrame).map(([k, val]) => {
      const numK = { from: 0, to: 100 }[k] ?? Number(k.slice(0, -1));
      if (isNaN(numK) || numK > 100 || numK < 0) {
        throw Error('keyFrame must between 0~100');
      }
      return [numK / 100, val];
    }) as TAnimationKeyFrame;
    this.#animatOpts = Object.assign({}, this.#animatOpts, {
      duration: opts.duration * 1e6,
      delay: (opts.delay ?? 0) * 1e6,
      iterCount: opts.iterCount ?? Infinity,
    });
  }

  animate(time: number): void {
    if (
      this.#animatKeyFrame == null ||
      this.#animatOpts == null ||
      time < this.#animatOpts.delay
    )
      return;
    // todo: delay, other timing-function
    const updateProps = linearTimeFn(
      time,
      this.#animatKeyFrame,
      this.#animatOpts,
    );
    for (const k in updateProps) {
      switch (k) {
        case 'opacity':
          this.opacity = updateProps[k] as number;
          break;
        case 'x':
        case 'y':
        case 'w':
        case 'h':
        case 'angle':
          this.rect[k] = updateProps[k] as number;
          break;
      }
    }
  }

  abstract destroy(): void;
}

export function linearTimeFn(
  time: number,
  kf: TAnimationKeyFrame,
  opts: Required<IAnimationOpts>,
): Partial<TAnimateProps> {
  if (time / opts.duration >= opts.iterCount) return {};

  const t = time % opts.duration;

  const process = time === opts.duration ? 1 : t / opts.duration;
  const idx = kf.findIndex((it) => it[0] >= process);
  if (idx === -1) return {};

  const startState = kf[idx - 1];
  const nextState = kf[idx];
  const nextFrame = nextState[1];
  if (startState == null) return nextFrame;
  const startFrame = startState[1];

  const rs: Partial<TAnimateProps> = {};
  // 介于两个Frame状态间的进度
  const stateProcess =
    (process - startState[0]) / (nextState[0] - startState[0]);
  for (const prop in nextFrame) {
    const p = prop as keyof TAnimateProps;
    if (startFrame[p] == null) continue;
    // @ts-expect-error
    // eslint-disable-next-line
    rs[p] = (nextFrame[p] - startFrame[p]) * stateProcess + startFrame[p];
  }

  return rs;
}
