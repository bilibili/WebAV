/**
 * 二维坐标系中的点
 */
/**
 * Represents a point in a two-dimensional coordinate system.
 */
export interface IPoint {
  x: number;
  y: number;
}

/**
 * 元素的尺寸信息
 */
/**
 * Represents the resolution of an element.
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
  /**
   * The height of the element.
   */
  height: number;
}

/**
 * 画布的宽高
 */
/**
 * Represents the ratio of width to height for a canvas.
 */
export interface ICvsRatio {
  w: number;
  h: number;
}
