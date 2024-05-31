import { EventTool } from '../event-tool';

interface IPoint {
  x: number;
  y: number;
}

export type TCtrlKey =
  | 't'
  | 'b'
  | 'l'
  | 'r'
  | 'lt'
  | 'lb'
  | 'rt'
  | 'rb'
  | 'rotate';

export const CTRL_KEYS = [
  't',
  'b',
  'l',
  'r',
  'lt',
  'lb',
  'rt',
  'rb',
  'rotate',
] as const;

export interface IRectBaseProps {
  x: number;
  y: number;
  w: number;
  h: number;
  angle: number;
}

export class Rect implements IRectBaseProps {
  /**
   * ctrl 节点的边长
   */
  static CTRL_SIZE = 16;

  #evtTool = new EventTool<{
    propsChange: (props: Partial<IRectBaseProps>) => void;
  }>();
  on = this.#evtTool.on;

  #x = 0;
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
  set y(v) {
    this.#setBaseProps('y', v);
  }
  #w = 0;
  get w() {
    return this.#w;
  }
  set w(v) {
    this.#setBaseProps('w', v);
  }
  #h = 0;
  get h() {
    return this.#h;
  }
  set h(v) {
    this.#setBaseProps('h', v);
  }
  #angle = 0;
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

    // concat emit
    // if (changed) this.#nextTickEmitData[prop] = v;
    // Promise.resolve().then(() => {
    //   if (Object.keys(this.#nextTickEmitData).length > 0) {
    //     const data = this.#nextTickEmitData;
    //     this.#nextTickEmitData = {};
    //     this.#evtTool.emit('propsChange', { ...data });
    //   }
    // });
  }

  /**
   * ctrl.master is sprite rect
   */
  master: Rect | null = null;

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
    this.master = master ?? null;
  }

  get center(): IPoint {
    const { x, y, w, h } = this;
    return { x: x + w / 2, y: y + h / 2 };
  }

  fixedAspectRatio = false;

  // 上下左右+四个角+旋转控制点
  get ctrls() {
    const { w, h } = this;
    // 控制点元素大小, 以 分辨率 为基准
    const sz = Rect.CTRL_SIZE;
    // half size
    const hfSz = sz / 2;
    const hfW = w / 2;
    const hfH = h / 2;
    // rotate size
    const rtSz = sz * 1.5;
    const hfRtSz = rtSz / 2;
    // ctrl 坐标是相对于 sprite 中心点
    const tblr = this.fixedAspectRatio
      ? {}
      : {
          t: new Rect(-hfSz, -hfH - hfSz, sz, sz, this),
          b: new Rect(-hfSz, hfH - hfSz, sz, sz, this),
          l: new Rect(-hfW - hfSz, -hfSz, sz, sz, this),
          r: new Rect(hfW - hfSz, -hfSz, sz, sz, this),
        };
    return {
      ...tblr,
      lt: new Rect(-hfW - hfSz, -hfH - hfSz, sz, sz, this),
      lb: new Rect(-hfW - hfSz, hfH - hfSz, sz, sz, this),
      rt: new Rect(hfW - hfSz, -hfH - hfSz, sz, sz, this),
      rb: new Rect(hfW - hfSz, hfH - hfSz, sz, sz, this),
      rotate: new Rect(-hfRtSz, -hfH - sz * 2 - hfRtSz, rtSz, rtSz, this),
    };
  }

  clone(): Rect {
    const { x, y, w, h, master } = this;
    const rect = new Rect(x, y, w, h, master);
    rect.angle = this.angle;
    rect.fixedAspectRatio = this.fixedAspectRatio;
    return rect;
  }

  /**
   * 检测点击是否命中
   */
  checkHit(tx: number, ty: number): boolean {
    let { angle, center, x, y, w, h, master } = this;
    // ctrls 的中心点、旋转角度都去自于 master （sprite）
    const cnt = master?.center ?? center;
    const agl = master?.angle ?? angle;
    // ctrl 初始化时其坐标就是相对于 master 的，参见 get ctrls()
    // 所以此处不用转换
    if (master == null) {
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
