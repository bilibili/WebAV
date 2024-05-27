import { BaseSprite } from './base-sprite';
import { IClip } from '../clips';
import { Log } from '../log';

export class VisibleSprite extends BaseSprite {
  #clip: IClip;
  getClip() {
    return this.#clip;
  }

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

  // 保持最近一帧，若 clip 在当前帧无数据，则绘制最近一帧
  #lastVf: VideoFrame | ImageBitmap | null = null;
  #lastAudio: Float32Array[] = [];
  #ticking = false;
  #update(time: number) {
    if (this.#ticking) return;
    this.#ticking = true;
    this.#clip
      .tick(time)
      .then(({ video, audio }) => {
        if (video != null) {
          this.#lastVf?.close();
          this.#lastVf = video ?? null;
        }
        this.#lastAudio = audio ?? [];
      })
      .finally(() => {
        this.#ticking = false;
      });
  }

  /**
   * 提前准备首帧，避免初次绘制时缺少帧导致闪烁
   */
  preFirstFrame() {
    this.#update(0);
  }

  #lastTime = -1;
  render(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    time: number,
  ): { audio: Float32Array[] } {
    this.animate(time);
    super._render(ctx);
    const { w, h } = this.rect;
    if (this.#lastTime !== time) this.#update(time);
    this.#lastTime = time;

    const audio = this.#lastAudio;
    this.#lastAudio = [];
    const video = this.#lastVf;
    if (video != null) ctx.drawImage(video, -w / 2, -h / 2, w, h);

    return { audio };
  }

  #destroyed = false;
  destroy(): void {
    if (this.#destroyed) return;
    this.#destroyed = true;

    Log.info('VisibleSprite destroy');
    super.destroy();
    this.#lastVf?.close();
    this.#lastVf = null;
    this.#clip.destroy();
  }
}
