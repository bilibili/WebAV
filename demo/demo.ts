import { AVCanvas } from '../src/av-canvas'
import { VideoSprite } from '../src/sprites'

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
    video: true
  })
  const vRes = new VideoSprite('camera', mediaStream)
  avCvs.spriteManager.addSprite(vRes)
})().catch(console.error)
