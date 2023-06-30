import { chromakey } from '../src/chromakey'

;(async () => {
  const img = new Image()
  img.src = './public/img/green-girl.png'
  await new Promise(resolve => {
    img.onload = resolve
  })
  chromakey(img)
})()
