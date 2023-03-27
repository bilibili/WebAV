
interface IPoint { x: number; y: number }

class BaseResource {
  #pos: IPoint = { x: 0, y: 0 }

  get pos(): IPoint { return this.#pos }
  set pos(pos: IPoint) { this.#pos = pos }

  #visible = true
  get visible(): boolean { return this.#visible }
  set visible(visible: boolean) { this.#visible = visible }

  #canMove = true
  get canMove(): boolean { return this.#canMove }
  set canMove(canMove: boolean) { this.#canMove = canMove }

  #zIndex= 0
  get zIndex(): number { return this.#zIndex}
  set zIndex(zIndex: number) { this.#zIndex= zIndex}

  constructor(public name: string) {}
}

export class VideoResource extends BaseResource {
  constructor(name: string) {
    super(name)
  }
}

export class ResourceManager {
  #resList: Array<BaseResource> = []

  addResource<R extends BaseResource>(res: R): void {
    this.#resList.push(res)
    this.#resList = this.#resList.sort((a, b) => a.zIndex - b.zIndex)
  }

  getResourceList(): Array<BaseResource> {
    return this.#resList
  }
}
