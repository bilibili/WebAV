import { createEl } from '../utils'
import { BaseSprite } from './base-sprite'

interface IFontStyle {
  color: string
  family: string
  size: number
}

function renderTxt2Img (txt: string, cssText: string): HTMLImageElement {
  const div = createEl('div')
  div.style.cssText = `${cssText} visibility: hidden; position: fixed;`
  div.textContent = txt
  document.body.appendChild(div)

  const { width, height } = div.getBoundingClientRect()
  // 计算出 rect，立即从dom移除
  div.remove()
  div.style.visibility = 'visible'

  const img = new Image()
  img.width = width
  img.height = height
  const svg = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <foreignObject width="100%" height="100%">
        <div xmlns="http://www.w3.org/1999/xhtml">${div.outerHTML}</div>
    </foreignObject>
    </svg>
  `

  const svgBlob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
  const svgObjectUrl = URL.createObjectURL(svgBlob)

  img.src = svgObjectUrl
  return img
}

export class FontSprite extends BaseSprite {
  #img: HTMLImageElement

  constructor (name: string, content: string, style: Partial<IFontStyle> = {}) {
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

  render (ctx: CanvasRenderingContext2D): void {
    super.render(ctx)
    const { w, h } = this.rect
    ctx.drawImage(this.#img, -w / 2, -h / 2, w, h)
  }

  destory (): void {
    URL.revokeObjectURL(this.#img.src)
  }
}
