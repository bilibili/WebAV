import { createEl } from '../utils';
import { BaseSprite } from '@webav/av-cliper';

interface IAudioSpriteOpts {
  audioCtx?: AudioContext;
}

export class AudioSprite extends BaseSprite {
  #audioEl = createEl('audio') as HTMLAudioElement;

  // 音频节点没有可视内容
  readonly visible = false;

  constructor(name: string, source: File, opts: IAudioSpriteOpts = {}) {
    super(name);
    if (!['audio/mpeg', 'audio/ogg', 'audio/wav'].includes(source.type))
      throw new Error('Unsupport audio format');

    if (opts.audioCtx != null) {
      this.audioNode = opts.audioCtx.createGain();
      opts.audioCtx
        .createMediaElementSource(this.#audioEl)
        .connect(this.audioNode);
    }

    this.#audioEl.loop = true;
    this.#audioEl.src = URL.createObjectURL(source);
    this.#audioEl.play().catch(console.error);
  }

  destroy(): void {
    this.#audioEl.remove();
    this.audioNode?.disconnect();
    URL.revokeObjectURL(this.#audioEl.src);
  }
}
