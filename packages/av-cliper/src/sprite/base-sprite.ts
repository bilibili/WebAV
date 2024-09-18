import { EventTool } from '../event-tool';
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

/**
 * Sprite 基类
 *
 * @see {@link OffscreenSprite}
 * @see {@link VisibleSprite}
 */
export abstract class BaseSprite {
  /**
   * 控制素材在视频中的空间属性（坐标、旋转、缩放）
   */
  rect = new Rect();

  /**
   * 控制素材在的时间偏移、时长、播放速率，常用于剪辑场景时间轴（轨道）模块
   * duration 不能大于引用 {@link IClip} 的时长，单位 微秒
   *
   * playbackRate 控制当前素材的播放速率，1 表示正常播放；
   * **注意**
   *    1. 设置 playbackRate 时需要主动修正 duration
   *    2. 音频使用最简单的插值算法来改变速率，所以改变速率后音调会产生变化，自定义算法请使用 {@link MP4Clip.tickInterceptor} 配合实现
   *
   */
  #time = {
    offset: 0,
    duration: 0,
    playbackRate: 1,
  };
  get time(): { offset: number; duration: number; playbackRate: number } {
    return this.#time;
  }
  set time(v: { offset: number; duration: number; playbackRate?: number }) {
    Object.assign(this.#time, v);
  }

  /**
   * 元素是否可见，用于不想删除，期望临时隐藏 Sprite 的场景
   */
  visible = true;

  #evtTool = new EventTool<{
    propsChange: (
      value: Partial<{ rect: Partial<Rect>; zIndex: number }>,
    ) => void;
  }>();
  /**
   * 监听属性变更事件
   * @example
   * sprite.on('propsChange', (changedProps) => {})
   */
  on = this.#evtTool.on;

  #zIndex = 0;
  get zIndex(): number {
    return this.#zIndex;
  }

  /**
   * 控制素材间的层级关系，zIndex 值较小的素材会被遮挡
   */
  set zIndex(v: number) {
    const changed = this.#zIndex !== v;
    this.#zIndex = v;
    if (changed) this.#evtTool.emit('propsChange', { zIndex: v });
  }

  /**
   * 不透明度
   */
  opacity = 1;

  /**
   * 水平或垂直方向翻转素材
   */
  flip: 'horizontal' | 'vertical' | null = null;

  #animatKeyFrame: TAnimationKeyFrame | null = null;

  #animatOpts: Required<IAnimationOpts> | null = null;

  /**
   * @see {@link IClip.ready}
   */
  ready = Promise.resolve();

  constructor() {
    this.rect.on('propsChange', (props) => {
      this.#evtTool.emit('propsChange', { rect: props });
    });
  }

  protected _render(
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

  /**
   * 给素材添加动画，使用方法参考 css animation
   *
   * @example
   * sprite.setAnimation(
   *   {
   *     '0%': { x: 0, y: 0 },
   *     '25%': { x: 1200, y: 680 },
   *     '50%': { x: 1200, y: 0 },
   *     '75%': { x: 0, y: 680 },
   *     '100%': { x: 0, y: 0 },
   *   },
   *   { duration: 4, iterCount: 1 },
   * );
   *
   * @see [视频水印动画](https://bilibili.github.io/WebAV/demo/2_1-concat-video)
   */
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

  /**
   * 如果当前 sprite 已被设置动画，将 sprite 的动画属性设定到指定时间的状态
   */
  animate(time: number): void {
    if (
      this.#animatKeyFrame == null ||
      this.#animatOpts == null ||
      time < this.#animatOpts.delay
    )
      return;
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

  /**
   * 将当前 sprite 的属性赋值到目标
   *
   * 用于 clone，或 {@link VisibleSprite} 与 {@link OffscreenSprite} 实例间的类型转换
   */
  copyStateTo<T extends BaseSprite>(target: T) {
    target.#animatKeyFrame = this.#animatKeyFrame;
    target.#animatOpts = this.#animatOpts;
    target.visible = this.visible;
    target.zIndex = this.zIndex;
    target.opacity = this.opacity;
    target.flip = this.flip;
    target.rect = this.rect.clone();
    target.time = { ...this.time };
  }

  protected destroy() {
    this.#evtTool.destroy();
  }
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
