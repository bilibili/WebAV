import { EventTool } from '../event-tool'
import { BaseSprite } from './base-sprite'

export class SpriteManager {
  #sprites: BaseSprite[] = []

  #activeSprite: BaseSprite | null = null

  #evtTool = new EventTool<{
    add: (s: BaseSprite) => void
  }>()

  on = this.#evtTool.on

  get activeSprite (): BaseSprite | null { return this.#activeSprite }
  set activeSprite (s: BaseSprite | null) {
    if (s === this.#activeSprite) return
    if (s == null) {
      if (this.#activeSprite != null) this.#activeSprite.actived = false
    } else {
      s.actived = true
    }
    this.#activeSprite = s
  }

  addSprite<S extends BaseSprite>(s: S): void {
    this.#sprites.push(s)
    this.#sprites = this.#sprites.sort((a, b) => a.zIndex - b.zIndex)
    this.#evtTool.emit('add', s)
    // todo: 动态适配canvas宽高
  }

  getSprites (): BaseSprite[] {
    return [...this.#sprites]
  }
}
