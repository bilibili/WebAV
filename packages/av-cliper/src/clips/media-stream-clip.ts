import { autoReadStream } from '@webav/internal-utils';
import { IClip } from './iclip';

/**
 * 包装实时音视频流，仅用于 [AVCanvas](../../av-canvas/classes/AVCanvas.html)
 *
 * ⚠️ 不可用于 {@link Combinator} ，因为后台合成视频的速度是快于物理时间的，实时流无法提供非实时的数据
 *
 * @example
 * const spr = new VisibleSprite(
 *   new MediaStreamClip(
 *     await navigator.mediaDevices.getUserMedia({ video: true, audio: true, }),
 *   ),
 * );
 * await avCvs.addSprite(spr);
 */
export class MediaStreamClip implements IClip {
  static ctx: AudioContext | null = null;

  ready: IClip['ready'];

  #meta = {
    // 微秒
    duration: 0,
    width: 0,
    height: 0,
  };

  get meta() {
    return {
      ...this.#meta,
    };
  }

  #stopRenderCvs = () => {};

  /**
   * 实时流的音轨
   */
  readonly audioTrack: MediaStreamAudioTrack | null;

  #cvs: OffscreenCanvas | null = null;

  #ms: MediaStream;
  constructor(ms: MediaStream) {
    this.#ms = ms;
    this.audioTrack = ms.getAudioTracks()[0] ?? null;
    this.#meta.duration = Infinity;
    const videoTrack = ms.getVideoTracks()[0];
    if (videoTrack != null) {
      videoTrack.contentHint = 'motion';
      this.ready = new Promise((resolve) => {
        this.#stopRenderCvs = renderVideoTrackToCvs(videoTrack, (cvs) => {
          this.#meta.width = cvs.width;
          this.#meta.height = cvs.height;
          this.#cvs = cvs;
          resolve(this.meta);
        });
      });
    } else {
      this.ready = Promise.resolve(this.meta);
    }
  }

  async tick(): Promise<{
    video: ImageBitmap | null;
    audio: Float32Array[];
    state: 'success';
  }> {
    return {
      video: this.#cvs == null ? null : await createImageBitmap(this.#cvs),
      audio: [],
      state: 'success',
    };
  }

  async split() {
    return [await this.clone(), await this.clone()] as [this, this];
  }

  async clone() {
    return new MediaStreamClip(this.#ms.clone()) as this;
  }

  destroy(): void {
    this.#ms.getTracks().forEach((t) => t.stop());
    this.#stopRenderCvs();
  }
}

function renderVideoTrackToCvs(
  track: MediaStreamVideoTrack,
  onOffscreenCanvasReady: (cvs: OffscreenCanvas) => void,
) {
  let emitFF = false;
  let cvsCtx: OffscreenCanvasRenderingContext2D;
  return autoReadStream(
    new MediaStreamTrackProcessor({
      track,
    }).readable,
    {
      onChunk: async (frame) => {
        if (!emitFF) {
          const { displayHeight, displayWidth } = frame;
          const width = displayWidth ?? 0;
          const height = displayHeight ?? 0;
          const cvs = new OffscreenCanvas(width, height);
          cvsCtx = cvs.getContext('2d')!;
          onOffscreenCanvasReady(cvs);
          emitFF = true;
        }
        cvsCtx.drawImage(frame, 0, 0);
        frame.close();
      },
      onDone: async () => {},
    },
  );
}
