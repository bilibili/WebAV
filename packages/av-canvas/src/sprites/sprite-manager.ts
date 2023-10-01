import { EventTool } from '../event-tool'
import { BaseSprite } from '@webav/av-cliper'

export enum ESpriteManagerEvt {
  ActiveSpriteChange = 'activeSpriteChange',
  AddSprite = 'addSprite'
}

export class SpriteManager {
  #sprites: BaseSprite[] = []

  #activeSprite: BaseSprite | null = null

  #evtTool = new EventTool<{
    [ESpriteManagerEvt.AddSprite]: (s: BaseSprite) => void
    [ESpriteManagerEvt.ActiveSpriteChange]: (s: BaseSprite | null) => void
  }>()

  audioCtx = new AudioContext()

  audioMSDest = this.audioCtx.createMediaStreamDestination()

  on = this.#evtTool.on

  get activeSprite(): BaseSprite | null { return this.#activeSprite }
  set activeSprite(s: BaseSprite | null) {
    if (s === this.#activeSprite) return
    this.#activeSprite = s
    this.#evtTool.emit(ESpriteManagerEvt.ActiveSpriteChange, s)
  }

  constructor() {
    this.#bgAudio()
  }

  async addSprite<S extends BaseSprite>(s: S): Promise<void> {
    await s.initReady
    this.#sprites.push(s)
    this.#sprites = this.#sprites.sort((a, b) => a.zIndex - b.zIndex)
    s.audioNode?.connect(this.audioMSDest)

    this.#evtTool.emit(ESpriteManagerEvt.AddSprite, s)
  }

  /**
   * Sort in ascending order by sprite.zIndex
   */
  sortSprite() {
    this.#sprites = this.#sprites.sort((a, b) => a.zIndex - b.zIndex)
  }

  removeSprite(spr: BaseSprite): void {
    this.#sprites = this.#sprites.filter(s => s !== spr)
    spr.destroy()
  }

  getSprites(): BaseSprite[] {
    return [...this.#sprites]
  }

  destroy(): void {
    this.#evtTool.destroy()
    this.#sprites.forEach(s => s.destroy())
    this.#sprites = []
    this.audioMSDest.disconnect()
    this.audioCtx.close().catch(console.error)
  }

  // 添加背景音，如果没有音频，录制的webm不正常
  #bgAudio(): void {
    const oscillator = this.audioCtx.createOscillator()
    const wave = this.audioCtx.createPeriodicWave(
      new Float32Array([0, 0]),
      new Float32Array([0, 0]),
      { disableNormalization: true }
    )
    oscillator.setPeriodicWave(wave)
    oscillator.connect(this.audioMSDest)
    oscillator.start()
  }
}
