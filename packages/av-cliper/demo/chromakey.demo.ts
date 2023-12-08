import { createChromakey } from '../src/chromakey'

const cvs = document.querySelector('#canvas') as HTMLCanvasElement
const ctx = cvs.getContext('2d', {
  alpha: true
})!

  ; (async () => {
    const img = new Image()
    img.src = './img/green-dog.jpeg'
    await new Promise(resolve => {
      img.onload = resolve
    })
    const chromakey = createChromakey({
      similarity: 0.4,
      smoothness: 0.05,
      spill: 0.05,
    })
    console.time('cost')
    // ctx.drawImage(await chromakey(await createImageBitmap(img)), 0, 0, cvs.width, cvs.height)
    ctx.drawImage(await chromakey(img), 0, 0, cvs.width, cvs.height)
    console.timeEnd('cost')
  })()
