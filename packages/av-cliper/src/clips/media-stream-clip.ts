import { autoReadStream } from '../av-utils';
import { IClip } from './iclip';

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
    const videoTrack = ms.getVideoTracks()[0];
    if (videoTrack != null) {
      const { width, height } = videoTrack.getSettings();
      videoTrack.contentHint = 'motion';
      this.#meta.width = width ?? 0;
      this.#meta.height = height ?? 0;

      this.#cvs = new OffscreenCanvas(width ?? 0, height ?? 0);
      this.#stopRenderCvs = renderVideoTrackToCvs(
        this.#cvs.getContext('2d')!,
        videoTrack,
      );
    }

    this.audioTrack = ms.getAudioTracks()[0] ?? null;

    this.#meta.duration = Infinity;
    this.ready = Promise.resolve(this.meta);
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
  cvsCtx: OffscreenCanvasRenderingContext2D,
  track: MediaStreamVideoTrack,
) {
  return autoReadStream(
    new MediaStreamTrackProcessor({
      track,
    }).readable,
    {
      onChunk: async (frame) => {
        cvsCtx.drawImage(frame, 0, 0);
        frame.close();
      },
      onDone: async () => {},
    },
  );
}
