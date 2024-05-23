// 在主线程中执行的 工具函数

export function createEl(tagName: string): HTMLElement {
  return document.createElement(tagName);
}

export function renderTxt2Img(txt: string, cssText: string): HTMLImageElement {
  const div = createEl('pre');
  div.style.cssText = `margin: 0; ${cssText}; visibility: hidden; position: fixed;`;
  div.textContent = txt;
  document.body.appendChild(div);

  const { width, height } = div.getBoundingClientRect();
  // 计算出 rect，立即从dom移除
  div.remove();
  div.style.visibility = 'visible';

  const img = new Image();
  img.width = width;
  img.height = height;
  const svgStr = `
    <svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
    <foreignObject width="100%" height="100%">
        <div xmlns="http://www.w3.org/1999/xhtml">${div.outerHTML}</div>
    </foreignObject>
    </svg>
  `
    .replace(/\t/g, '')
    .replace(/#/g, '%23');

  img.src = `data:image/svg+xml;charset=utf-8,${svgStr}`;
  return img;
}

export async function renderTxt2ImgBitmap(
  txt: string,
  cssText: string,
): Promise<ImageBitmap> {
  const imgEl = renderTxt2Img(txt, cssText);
  await new Promise((resolve) => {
    imgEl.onload = resolve;
  });
  const cvs = new OffscreenCanvas(imgEl.width, imgEl.height);
  const ctx = cvs.getContext('2d');
  ctx?.drawImage(imgEl, 0, 0, imgEl.width, imgEl.height);
  return await createImageBitmap(cvs);
}
