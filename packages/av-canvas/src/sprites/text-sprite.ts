import { renderTxt2Img, BaseSprite } from '@webav/av-cliper'

interface IFontStyle {
  color: string
  family: string
  size: number
}

export class TextSprite extends BaseSprite {
  #img: HTMLImageElement

  constructor(name: string, content: string, style: Partial<IFontStyle> = {}) {
    super(name)
    const s = {
      color: '#ffffff',
      size: 100,
      family: 'sans-serif',
      ...style
    }

    this.#img = renderTxt2Img(
      content,
      `
        font-size: ${s.size}px;
        color: ${s.color};
        font-family: ${s.family};
      `
    )
    this.rect.w = this.#img.width
    this.rect.h = this.#img.height
  }

  render(ctx: CanvasRenderingContext2D): void {
    super.render(ctx)
    const { w, h } = this.rect
    ctx.drawImage(this.#img, -w / 2, -h / 2, w, h)
  }

  destroy(): void { }
}
