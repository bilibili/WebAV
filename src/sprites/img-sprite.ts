import { BaseSprite } from './base-sprite'

export class ImgSprite extends BaseSprite {
  #img: HTMLImageElement = new Image()

  constructor (name: string, source: File) {
    super(name)
    if (
      !['image/png', 'image/jpg', 'image/jpeg', 'image/bmp', 'image/gif']
        .includes(source.type)
    ) throw Error('Unsupported image format')

    this.#init(source).catch(console.error)
  }

  async #init (file: File): Promise<void> {
    this.#img.onload = () => {
      this.rect.w = this.#img.width
      this.rect.h = this.#img.height
    }
    this.#img.src = await file2B64(file)
  }

  render (ctx: CanvasRenderingContext2D): void {
    super.render(ctx)
    const { w, h } = this.rect
    ctx.drawImage(this.#img, -w / 2, -h / 2, w, h)
    ctx.resetTransform()
  }

  destory (): void {
    this.#img.remove()
  }
}

async function file2B64 (file: File): Promise<string> {
  return await new Promise((resolve) => {
    const fileReader = new FileReader()
    fileReader.onload = function (e) {
      resolve((e.target as FileReader).result as string)
    }
    fileReader.readAsDataURL(file)
  })
}
