import { createChromakey } from '../src/chromakey'

const cvs = document.querySelector('#canvas') as HTMLCanvasElement
const ctx = cvs.getContext('2d', {
  alpha: true
})!

;(async () => {
  const img = new Image()
  img.src = './public/img/green-dog.jpeg'
  await new Promise(resolve => {
    img.onload = resolve
  })
  const chromakey = createChromakey({
    keyColor: [65, 249, 0]
  })
  console.time('cost')
  ctx.drawImage(await chromakey(img), 0, 0, cvs.width, cvs.height)
  console.timeEnd('cost')
})()
