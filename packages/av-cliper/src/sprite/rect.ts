import { EventTool } from '@webav/internal-utils';

interface IPoint {
  x: number;
  y: number;
}

export interface IRectBaseProps {
  x: number;
  y: number;
  w: number;
  h: number;
  angle: number;
}

/**
 * 用于记录素材在视频或画布中的空间属性：位置、大小、旋转
 *
 * 并提供控制点位置，支持用户在画布中缩放、旋转素材
 *
 * 一般由内部 WebAV SDK 内部创建维护
 *
 * @see {@link Combinator}, {@link OffscreenSprite}
 * @see [AVCanvas](../../av-canvas/classes/AVCanvas.html), {@link VisibleSprite}
 *
 * @see [视频剪辑](https://webav-tech.github.io/WebAV/demo/6_4-video-editor)
 */
export class Rect implements IRectBaseProps {
  #evtTool = new EventTool<{
    propsChange: (props: Partial<IRectBaseProps>) => void;
  }>();
  /**
   * 监听属性变更事件
   * @example
   * rect.on('propsChange', (changedProps) => {})
   */
  on = this.#evtTool.on;

  #x = 0;
  /**
   * x 坐标
   */
  get x() {
    return this.#x;
  }
  set x(v) {
    this.#setBaseProps('x', v);
  }
  #y = 0;
  get y() {
    return this.#y;
  }
  /**
   * y 坐标
   */
  set y(v) {
    this.#setBaseProps('y', v);
  }
  #w = 0;
  /**
   * 宽
   */
  get w() {
    return this.#w;
  }
  set w(v) {
    this.#setBaseProps('w', v);
  }
  #h = 0;
  /**
   * 高
   */
  get h() {
    return this.#h;
  }
  set h(v) {
    this.#setBaseProps('h', v);
  }
  #angle = 0;
  /**
   * 旋转角度
   * @see [MDN Canvas rotate](https://developer.mozilla.org/docs/Web/API/CanvasRenderingContext2D/rotate)
   */
  get angle() {
    return this.#angle;
  }
  set angle(v) {
    this.#setBaseProps('angle', v);
  }

  #setBaseProps(prop: keyof IRectBaseProps, v: number) {
    const changed = this[prop] !== v;
    switch (prop) {
      case 'x':
        this.#x = v;
        break;
      case 'y':
        this.#y = v;
        break;
      case 'w':
        this.#w = v;
        break;
      case 'h':
        this.#h = v;
        break;
      case 'angle':
        this.#angle = v;
        break;
    }
    if (changed) this.#evtTool.emit('propsChange', { [prop]: v });
  }

  /**
   * 如果当前实例是 Rect 控制点之一，`master` 将指向该 Rect
   *
   * 控制点的坐标是相对于它的 `master` 定位
   */
  #master: Rect | null = null;

  constructor(
    x?: number,
    y?: number,
    w?: number,
    h?: number,
    master?: Rect | null,
  ) {
    this.x = x ?? 0;
    this.y = y ?? 0;
    this.w = w ?? 0;
    this.h = h ?? 0;
    this.#master = master ?? null;
  }

  /**
   * 根据坐标、宽高计算出来的矩形中心点
   */
  get center(): IPoint {
    const { x, y, w, h } = this;
    return { x: x + w / 2, y: y + h / 2 };
  }

  /**
   * 是否保持固定宽高比例，禁止变形缩放
   *
   * 值为 true 时，将缺少上下左右四个控制点
   */
  fixedAspectRatio = false;

  /**
   * 是否固定中心点进行缩放
   * 值为 true 时，固定中心点不变进行缩放
   * 值为 false 时，固定对角点不变进行缩放
   */
  fixedScaleCenter = false;

  clone(): Rect {
    const { x, y, w, h } = this;
    const rect = new Rect(x, y, w, h, this.#master);
    rect.angle = this.angle;
    rect.fixedAspectRatio = this.fixedAspectRatio;
    rect.fixedScaleCenter = this.fixedScaleCenter;
    return rect;
  }

  /**
   * 检测目标坐标是否命中当前实例
   * @param tx 目标点 x 坐标
   * @param ty 目标点 y 坐标
   */
  checkHit(tx: number, ty: number): boolean {
    let { angle, center, x, y, w, h } = this;
    // ctrls 的中心点、旋转角度都取自于 master （sprite）
    const cnt = this.#master?.center ?? center;
    const agl = this.#master?.angle ?? angle;
    // ctrl 初始化时其坐标就是相对于 master 的，参见 get ctrls()
    // 所以此处不用转换
    if (this.#master == null) {
      x = x - cnt.x;
      y = y - cnt.y;
    }
    // 鼠标点击坐标映射成以中点为原点的坐标
    const tOX = tx - cnt.x;
    const tOY = ty - cnt.y;
    // 如果有旋转，映射成相对 sprite 原点，旋转前的坐标
    let mx = tOX;
    let my = tOY;
    if (agl !== 0) {
      // 推导公式 https://github.com/hughfenghen/hughfenghen.github.io/issues/96
      mx = tOX * Math.cos(agl) + tOY * Math.sin(agl);
      my = tOY * Math.cos(agl) - tOX * Math.sin(agl);
    }

    if (mx < x || mx > x + w || my < y || my > y + h) return false;

    return true;
  }
}
