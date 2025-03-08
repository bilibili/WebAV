import { BaseSprite } from './base-sprite';
import { IClip } from '../clips';
import { Log } from '@webav/internal-utils';
import { changePCMPlaybackRate } from '../av-utils';

/**
 * 包装 {@link IClip} 给素材扩展坐标、层级、透明度等信息，用于 {@link Combinator} 在后台合成视频
 *
 * 跟 {@link VisibleSprite} 非常相似，应用场景不同
 *
 * @example
 * const spr = new OffscreenSprite(
 *   new MP4Clip((await fetch('<mp4 url>')).body),
 * );
 * spr.opacity = 0.5 // 半透明
 * spr.rect.x = 100 // x 坐标偏移 100 像素
 * spr.time.offset = 10e6 // 视频第 10s 开始绘制该视频素材
 *
 * @see [视频合成](https://webav-tech.github.io/WebAV/demo/2_1-concat-video)
 */
export class OffscreenSprite extends BaseSprite {
  #clip: IClip;

  // 保持最近一帧，若 clip 在当前帧无数据，则绘制最近一帧
  #lastVf: VideoFrame | ImageBitmap | null = null;

  #destroyed = false;

  constructor(clip: IClip) {
    super();
    this.#clip = clip;
    this.ready = clip.ready.then(({ width, height, duration }) => {
      this.rect.w = this.rect.w === 0 ? width : this.rect.w;
      this.rect.h = this.rect.h === 0 ? height : this.rect.h;
      this.time.duration =
        this.time.duration === 0 ? duration : this.time.duration;
    });
  }

  /**
   * 绘制素材指定时刻的图像到 canvas 上下文，并返回对应的音频数据
   * @param time 指定时刻，微秒
   */
  async offscreenRender(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    time: number,
  ): Promise<{
    audio: Float32Array[];
    done: boolean;
  }> {
    const ts = time * this.time.playbackRate;
    this.animate(ts);
    super._render(ctx);
    const { w, h } = this.rect;
    const { video, audio, state } = await this.#clip.tick(ts);
    let outAudio = audio ?? [];
    if (audio != null && this.time.playbackRate !== 1) {
      outAudio = audio.map((pcm) =>
        changePCMPlaybackRate(pcm, this.time.playbackRate),
      );
    }

    if (state === 'done') {
      return {
        audio: outAudio,
        done: true,
      };
    }

    const imgSource = video ?? this.#lastVf;
    if (imgSource != null) {
      ctx.drawImage(imgSource, -w / 2, -h / 2, w, h);
    }

    if (video != null) {
      this.#lastVf?.close();
      this.#lastVf = video;
    }

    return {
      audio: outAudio,
      done: false,
    };
  }

  async clone() {
    const spr = new OffscreenSprite(await this.#clip.clone());
    await spr.ready;
    this.copyStateTo(spr);
    return spr;
  }

  destroy(): void {
    if (this.#destroyed) return;
    this.#destroyed = true;

    Log.info('OffscreenSprite destroy');
    super.destroy();
    this.#lastVf?.close();
    this.#lastVf = null;
    this.#clip.destroy();
  }
}
