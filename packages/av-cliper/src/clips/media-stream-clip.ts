import { autoReadStream, extractPCM4AudioData } from '../av-utils';
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

  #streamReaders: Array<() => void> = [];

  #ms: MediaStream;
  #cvs: OffscreenCanvas | null = null;
  #ad: AudioData | null = null;
  constructor(ms: MediaStream) {
    this.#ms = ms;
    for (const trak of ms.getTracks()) {
      const { width, height } = trak.getSettings();
      if (trak.kind === 'video') {
        this.#meta.width = width ?? 0;
        this.#meta.height = height ?? 0;
        trak.contentHint = 'motion';
      }
      this.#cvs = new OffscreenCanvas(width ?? 0, height ?? 0);
      const ctx = this.#cvs.getContext('2d');
      this.#streamReaders.push(
        autoReadStream(
          new MediaStreamTrackProcessor({
            // @ts-ignore
            track: trak,
          }).readable as ReadableStream<VideoFrame | AudioData>,
          {
            onChunk: async (frame) => {
              if (frame instanceof VideoFrame) {
                ctx?.drawImage(frame, 0, 0);
                frame.close();
              } else {
                this.#ad?.close();
                this.#ad = frame;
              }
            },
            onDone: async () => {},
          },
        ),
      );
    }
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
      audio: this.#ad == null ? [] : extractPCM4AudioData(this.#ad),
      state: 'success',
    };
  }

  async split() {
    return [await this.clone(), await this.clone()] as [this, this];
  }

  async clone() {
    return new MediaStreamClip(
      this.#ms
        .getTracks()
        .map((t) => t.clone())
        .reduce((ms, track) => (ms.addTrack(track), ms), new MediaStream()),
    ) as this;
  }

  destroy(): void {
    this.#ms.getTracks().forEach((t) => t.stop());
    this.#streamReaders.forEach((r) => r());
  }
}
