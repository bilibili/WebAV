/**
 * 二维坐标系中的点
 */
export interface IPoint {
  x: number;
  y: number;
}

/**
 * 元素的尺寸信息
 */
export interface IResolution {
  /**
   * 宽度
   */
  /**
   * The width of the element.
   */
  width: number;

  /**
   * 高度
   */
  height: number;
}

/**
 * 画布的宽高
 */
export interface ICvsRatio {
  w: number;
  h: number;
}
