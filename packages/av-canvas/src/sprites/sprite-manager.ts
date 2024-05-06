import { VisibleSprite, EventTool } from '@webav/av-cliper';

export enum ESpriteManagerEvt {
  ActiveSpriteChange = 'activeSpriteChange',
  AddSprite = 'addSprite',
}

interface ISpriteWrap {
  offset: number;
  duration: number;
  sprite: VisibleSprite;
}

export class SpriteManager {
  #sprites: ISpriteWrap[] = [];

  #activeSprite: VisibleSprite | null = null;

  #evtTool = new EventTool<{
    [ESpriteManagerEvt.AddSprite]: (s: VisibleSprite) => void;
    [ESpriteManagerEvt.ActiveSpriteChange]: (s: VisibleSprite | null) => void;
  }>();

  audioCtx = new AudioContext();

  audioMSDest = this.audioCtx.createMediaStreamDestination();

  on = this.#evtTool.on;

  get activeSprite(): VisibleSprite | null {
    return this.#activeSprite;
  }
  set activeSprite(s: VisibleSprite | null) {
    if (s === this.#activeSprite) return;
    this.#activeSprite = s;
    this.#evtTool.emit(ESpriteManagerEvt.ActiveSpriteChange, s);
  }

  constructor() {
    this.#bgAudio();
  }

  async addSprite(
    s: VisibleSprite,
    opts: { offset?: number; duration?: number } = {},
  ): Promise<void> {
    await s.initReady;
    this.#sprites.push({
      sprite: s,
      offset: opts.offset ?? 0,
      duration: opts.duration ?? s.duration,
    });
    this.#sprites = this.#sprites.sort(
      (a, b) => a.sprite.zIndex - b.sprite.zIndex,
    );
    s.audioNode?.connect(this.audioMSDest);

    this.#evtTool.emit(ESpriteManagerEvt.AddSprite, s);
  }

  /**
   * Sort in ascending order by sprite.zIndex
   */
  sortSprite() {
    // todo: auto sort
    // this.#sprites = this.#sprites.sort((a, b) => a.zIndex - b.zIndex);
  }

  removeSprite(spr: VisibleSprite): void {
    this.#sprites = this.#sprites.filter((sw) => sw.sprite !== spr);
    spr.destroy();
  }

  getSprites(): ISpriteWrap[] {
    return [...this.#sprites];
  }

  destroy(): void {
    this.#evtTool.destroy();
    this.#sprites.forEach((sw) => sw.sprite.destroy());
    this.#sprites = [];
    this.audioMSDest.disconnect();
    this.audioCtx.close().catch(console.error);
  }

  // 添加背景音，如果没有音频，录制的webm不正常
  #bgAudio(): void {
    const oscillator = this.audioCtx.createOscillator();
    const wave = this.audioCtx.createPeriodicWave(
      new Float32Array([0, 0]),
      new Float32Array([0, 0]),
      { disableNormalization: true },
    );
    oscillator.setPeriodicWave(wave);
    oscillator.connect(this.audioMSDest);
    oscillator.start();
  }
}
