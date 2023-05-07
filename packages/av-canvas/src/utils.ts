export function createEl (tagName: string): HTMLElement {
  return document.createElement(tagName)
}

// todo: 合并，依赖 cliper
export function renderTxt2Img (txt: string, cssText: string): HTMLImageElement {
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
  const svgStr = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <foreignObject width="100%" height="100%">
        <div xmlns="http://www.w3.org/1999/xhtml">${div.outerHTML}</div>
    </foreignObject>
    </svg>
  `.replace(/\n/g, '').replace(/\t/g, '').replace(/#/g, '%23')

  img.src = `data:image/svg+xml;charset=utf-8,${svgStr}`
  return img
}
