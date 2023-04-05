import { AVCanvas } from '../src/av-canvas'
import { ImgSprite } from '../src/sprites/img-sprite'
import { VideoSprite } from '../src/sprites/video-sprite'

const avCvs = new AVCanvas(document.querySelector('#app') as HTMLElement, {
  bgColor: '#333',
  resolution: {
    width: 1920,
    height: 1080
  }
})

console.log({ avCvs })

;(async (): Promise<void> => {
  const mediaStream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true
  })
  const vs = new VideoSprite('camera', mediaStream, {
    audioCtx: avCvs.spriteManager.audioCtx
  })

  await avCvs.spriteManager.addSprite(vs)
  const is = new ImgSprite('img', 'https://neo-pages.bilibili.com/bbfe/neo/assets/img/neo-pages-overview.48f7bb81.png')
  await avCvs.spriteManager.addSprite(is)

  document.querySelector('#addImg')?.addEventListener('click', () => {
    ;(async () => {
      const [imgFH] = await (window as any).showOpenFilePicker({
        types: [{
          description: 'Images',
          accept: {
            'image/*': ['.png', '.gif', '.jpeg', '.jpg']
          }
        }]
      })
      const is = new ImgSprite('img', await imgFH.getFile())
      await avCvs.spriteManager.addSprite(is)
    })().catch(console.error)
  })
})().catch(console.error)
