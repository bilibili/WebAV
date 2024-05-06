import { BaseSprite } from './base-sprite';
import { IClip } from '../clips';
import { Log } from '../log';

export class VisibleSprite extends BaseSprite {
  /**
   * Clip duration
   */
  #duration = Infinity;
  get duration() {
    return this.#duration;
  }

  #clip: IClip;
  getClip() {
    return this.#clip;
  }

  constructor(clip: IClip) {
    super('');
    this.#clip = clip;
    this.initReady = clip.ready.then(({ width, height, duration }) => {
      this.rect.w = width;
      this.rect.h = height;
      this.#duration = duration;
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

  #lastTime = 0;
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
    const video = this.#lastVf;
    if (video != null) ctx.drawImage(video, -w / 2, -h / 2, w, h);

    return { audio };
  }

  #destroyed = false;
  destroy(): void {
    if (this.#destroyed) return;
    this.#destroyed = true;

    Log.info(`Sprite ${this.name} destroy`);
    this.#lastVf?.close();
    this.#lastVf = null;
    this.#clip.destroy();
  }
}
