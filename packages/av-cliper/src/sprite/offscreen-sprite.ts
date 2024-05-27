import { BaseSprite } from './base-sprite';
import { IClip } from '../clips';
import { Log } from '../log';

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

  async offscreenRender(
    ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D,
    time: number,
  ): Promise<{
    audio: Float32Array[];
    done: boolean;
  }> {
    this.animate(time);
    super._render(ctx);
    const { w, h } = this.rect;
    const { video, audio, state } = await this.#clip.tick(time);
    if (state === 'done') {
      return {
        audio: audio ?? [],
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
      audio: audio ?? [],
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
