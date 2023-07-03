import { chromakey } from '../src/chromakey'

const cvs = document.querySelector('#canvas') as HTMLCanvasElement
const ctx = cvs.getContext('2d')!
// const ctx = cvs.getContext('webgl')!

;(async () => {
  const img = new Image()
  console.log(111, img.width, img.height)
  img.src = './public/img/green-girl.png'
  await new Promise(resolve => {
    img.onload = resolve
  })
  ctx.drawImage(await chromakey(img), 0, 0, cvs.width, cvs.height)
  console.log(333, ctx.getImageData(0, 0, 10, 10))
  // ctx.drawImage(img, 0, 0, img.width, img.height)
})()
