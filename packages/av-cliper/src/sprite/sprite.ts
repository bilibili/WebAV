import { BaseSprite } from './base-sprite';
import { IClip } from '../clips';
import { Log } from '../log';

export class Sprite extends BaseSprite {
  ready: Promise<void>;

  /**
   * Clip duration
   */
  #duration = Infinity;
  get duration() {
    return this.#duration;
  }

  #clip: IClip;
  constructor(clip: IClip) {
    super('');
    this.#clip = clip;
    this.ready = clip.ready.then(({ width, height, duration }) => {
      this.rect.w = width;
      this.rect.h = height;
      this.#duration = duration;
    });
  }

  // 保持最近一帧，若 clip 在当前帧无数据，则绘制最近一帧
  #lastVf: VideoFrame | ImageBitmap | null = null;
  #lastTime = 0;
  #lastState = '';
  async render(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    time: number,
  ): Promise<{
    audio: Float32Array[];
    done: boolean;
  }> {
    this.animate(time);
    super._render(ctx);
    const { w, h } = this.rect;
    const { video, audio, state } =
      this.#lastTime === time
        ? { video: this.#lastVf, audio: [], state: this.#lastState }
        : await this.#clip.tick(time);

    this.#lastTime = time;
    this.#lastState = state;
    if (state === 'done') return { audio: audio ?? [], done: true };

    const imgSource = video ?? this.#lastVf;
    if (imgSource != null) {
      ctx.drawImage(imgSource, -w / 2, -h / 2, w, h);
    }

    if (video != null && this.#lastTime !== time) {
      this.#lastVf?.close();
      this.#lastVf = video;
    }

    return {
      audio: audio ?? [],
      done: false,
    };
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
