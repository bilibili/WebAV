import { EventTool } from '../event-tool'
import { BaseSprite } from './base-sprite'

export class SpriteManager {
  #sprites: BaseSprite[] = []

  #activeSprite: BaseSprite | null = null

  #evtTool = new EventTool<{
    add: (s: BaseSprite) => void
  }>()

  audioCtx = new AudioContext()

  audioMSDest = this.audioCtx.createMediaStreamDestination()

  on = this.#evtTool.on

  get activeSprite (): BaseSprite | null { return this.#activeSprite }
  set activeSprite (s: BaseSprite | null) {
    if (s === this.#activeSprite) return
    this.#activeSprite = s
  }

  constructor () {
    this.#bgAudio()
  }

  async addSprite<S extends BaseSprite>(s: S): Promise<void> {
    await s.initReady
    this.#sprites.push(s)
    this.#sprites = this.#sprites.sort((a, b) => a.zIndex - b.zIndex)
    s.audioNode?.connect(this.audioMSDest)

    // todo: event enum
    this.#evtTool.emit('add', s)
  }

  removeSprite (spr: BaseSprite): void {
    this.#sprites = this.#sprites.filter(s => s !== spr)
    spr.destory()
  }

  getSprites (): BaseSprite[] {
    return [...this.#sprites]
  }

  // 添加背景音，如果没有音频，录制的webm不正常
  #bgAudio (): void {
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
