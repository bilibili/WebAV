import { Rect } from '@webav/av-cliper';

/**
 * 二维坐标系中的点
 */
export interface IPoint {
  x: number;
  y: number;
}

/**
 * 分辨率（尺寸）
 */
export interface IResolution {
  width: number;
  height: number;
}

/**
 * 画布分辨率与实际宽高的比例
 */
export interface ICvsRatio {
  w: number;
  h: number;
}

/**
 * 控制点：上、下、左、右，左上、左下、右上、右下、旋转
 * 当 Rect 只允许等比例缩放时（{@link Rect.fixedAspectRatio} = true），缺少 t、b、l、r 四个控制点
 */
export type RectCtrls = Partial<Record<'t' | 'b' | 'l' | 'r', Rect>> &
  Record<'lt' | 'lb' | 'rt' | 'rb' | 'rotate', Rect>;

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

export type TCtrlKey = (typeof CTRL_KEYS)[number];
