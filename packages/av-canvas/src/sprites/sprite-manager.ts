import { VisibleSprite, EventTool } from '@webav/av-cliper';

export enum ESpriteManagerEvt {
  ActiveSpriteChange = 'activeSpriteChange',
  AddSprite = 'addSprite',
}

export class SpriteManager {
  #sprites: VisibleSprite[] = [];

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

  async addSprite(vs: VisibleSprite): Promise<void> {
    await vs.initReady;
    this.#sprites.push(vs);
    this.#sprites = this.#sprites.sort((a, b) => a.zIndex - b.zIndex);
    // todo: remove audioNode
    vs.audioNode?.connect(this.audioMSDest);

    this.#evtTool.emit(ESpriteManagerEvt.AddSprite, vs);
  }

  /**
   * Sort in ascending order by sprite.zIndex
   */
  sortSprite() {
    // todo: auto sort
    // this.#sprites = this.#sprites.sort((a, b) => a.zIndex - b.zIndex);
  }

  removeSprite(spr: VisibleSprite): void {
    this.#sprites = this.#sprites.filter((s) => s !== spr);
    spr.destroy();
  }

  getSprites(): VisibleSprite[] {
    return [...this.#sprites];
  }

  destroy(): void {
    this.#evtTool.destroy();
    this.#sprites.forEach((s) => s.destroy());
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
