import {
  autoReadStream,
  concatFloat32Array,
  extractPCM4AudioData,
} from '../av-utils';
import { DEFAULT_AUDIO_CONF, IClip } from './iclip';

export class MediaStreamClip implements IClip {
  static ctx: AudioContext | null = null;

  ready: IClip['ready'];

  #meta = {
    // 微秒
    duration: 0,
    width: 0,
    height: 0,
    isRenderedToSpeaker: true,
  };

  get meta() {
    return {
      ...this.#meta,
    };
  }

  #streamReaders: Array<() => void> = [];

  #ms: MediaStream;
  #cvs: OffscreenCanvas | null = null;
  #audioDataPool: [Float32Array, Float32Array] = [
    new Float32Array(),
    new Float32Array(),
  ];
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
                if (frame.sampleRate !== DEFAULT_AUDIO_CONF.sampleRate) {
                  throw Error(
                    `Unsupported audio sampleRate: ${frame.sampleRate}`,
                  );
                }
                const [chan0Buf, chan1Buf] = extractPCM4AudioData(frame);
                this.#audioDataPool[0] = concatFloat32Array([
                  this.#audioDataPool[0],
                  chan0Buf,
                ]);
                this.#audioDataPool[1] = concatFloat32Array([
                  this.#audioDataPool[1],
                  chan1Buf ?? chan0Buf,
                ]);
                frame.close();
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
    const audio = this.#audioDataPool;
    this.#audioDataPool = [new Float32Array(), new Float32Array()];
    return {
      video: this.#cvs == null ? null : await createImageBitmap(this.#cvs),
      audio,
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
