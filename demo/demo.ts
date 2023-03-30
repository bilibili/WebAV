import { AVCanvas } from '../src/av-canvas'
import { VideoResource } from '../src/resource'

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
  const vRes = new VideoResource('camera', mediaStream)
  avCvs.resourceManager.addResource(vRes)
})().catch(console.error)
