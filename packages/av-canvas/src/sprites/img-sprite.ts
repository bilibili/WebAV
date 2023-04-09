import { BaseSprite } from './base-sprite'

export class ImgSprite extends BaseSprite {
  #img: HTMLImageElement = new Image()

  constructor (name: string, source: File | string) {
    super(name)

    if (
      source instanceof File &&
      !['image/png', 'image/jpg', 'image/jpeg', 'image/bmp', 'image/gif']
        .includes(source.type)
    ) throw Error('Unsupport image format')

    this.initReady = this.#init(source).catch(console.error)
  }

  async #init (source: File | string): Promise<void> {
    const imgLoad = new Promise<void>((resolve, reject) => {
      this.#img.onload = () => {
        this.rect.w = this.#img.width
        this.rect.h = this.#img.height
        resolve()
      }
      this.#img.onerror = reject
    })

    this.#img.src = source instanceof File
      ? await file2B64(source)
      : source

    await imgLoad
  }

  render (ctx: CanvasRenderingContext2D): void {
    super.render(ctx)
    const { w, h } = this.rect
    ctx.drawImage(this.#img, -w / 2, -h / 2, w, h)
  }

  destroy (): void {
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
