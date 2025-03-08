interface IClipMeta {
  width: number;
  height: number;
  duration: number;
}

/**
 * 所有素材需要实现的接口
 *
 * 素材（Clip）是不同数据类型的抽象，给其他模块提供数据
 *
 * WebAV 内置了 {@link MP4Clip}, {@link AudioClip}, {@link ImgClip}, {@link MediaStreamClip} 等常用素材，用于给 {@link Combinator} {@link AVCanvas} 提供数据
 *
 * 你只需实现该接口即可自定义素材，拥有最大的灵活度来生成视频内容，比如动画、转场效果等
 * @see [自定义素材](https://webav-tech.github.io/WebAV/demo/2_6-custom-clip)
 *
 */
export interface IClip {
  /**
   * 从素材中提取指定时间数据
   * @param time 时间，单位 微秒
   */
  tick: (time: number) => Promise<{
    video?: VideoFrame | ImageBitmap | null;
    audio?: Float32Array[];
    state: 'done' | 'success';
  }>;

  /**
   * 当素材准备完成，ready 会切换到 resolved 状态
   */
  readonly ready: Promise<IClipMeta>;

  /**
   * 数据元数据
   */
  readonly meta: IClipMeta;

  /**
   * clone，返回一个新素材
   */
  clone: () => Promise<this>;

  /**
   * 按指定时间切割，返回该时刻前后两个新素材，常用于剪辑场景按时间分割素材
   *
   * 该方法不会破坏原素材的数据
   *
   * @param time 时间，微秒
   * @returns
   */
  split?: (time: number) => Promise<[this, this]>;

  /**
   * 销毁实例，释放资源
   */
  destroy: () => void;
}

/**
 * 默认的音频设置，⚠️ 不要变更它的值 ⚠️
 */
export const DEFAULT_AUDIO_CONF = {
  sampleRate: 48000,
  channelCount: 2,
  codec: 'mp4a.40.2',
} as const;
