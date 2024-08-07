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
 * 音频配置参数
 */
interface AudioConfig {
  playbackRate: number;
}

/**
 * 音频结构参数
 */
export interface AudiosSchema {
  pcmData: Float32Array[];
  audioConfig: AudioConfig;
}

/**
 * 音频播放源结构参数
 */
export interface AudioSourceSchema {
  audioSource: AudioBufferSourceNode;
  audioConfig: AudioConfig;
}
