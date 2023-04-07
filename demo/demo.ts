import fixWebmDur from 'fix-webm-duration'
import { AVCanvas } from '../src/av-canvas'
import { FontSprite } from '../src/sprites/font-sprite'
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
  // const is = new ImgSprite('img', 'https://neo-pages.bilibili.com/bbfe/neo/assets/img/neo-pages-overview.48f7bb81.png')
  // await avCvs.spriteManager.addSprite(is)
})().catch(console.error)
document.querySelector('#userMedia')?.addEventListener('click', () => {
  ;(async () => {
    const mediaStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true
    })
    const vs = new VideoSprite('userMedia', mediaStream, {
      audioCtx: avCvs.spriteManager.audioCtx
    })
    await avCvs.spriteManager.addSprite(vs)
  })().catch(console.error)
})

document.querySelector('#display')?.addEventListener('click', () => {
  ;(async () => {
    const mediaStream = await navigator.mediaDevices.getDisplayMedia({
      video: true,
      audio: true
    })
    const vs = new VideoSprite('display', mediaStream, {
      audioCtx: avCvs.spriteManager.audioCtx
    })
    await avCvs.spriteManager.addSprite(vs)
  })().catch(console.error)
})

document.querySelector('#localImg')?.addEventListener('click', () => {
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

document.querySelector('#localVideo')?.addEventListener('click', () => {
  ;(async () => {
    const [imgFH] = await (window as any).showOpenFilePicker({
      types: [{
        description: 'Video',
        accept: {
          'video/*': ['.webm', '.mp4']
        }
      }]
    })
    const vs = new VideoSprite('vs', await imgFH.getFile())
    await avCvs.spriteManager.addSprite(vs)
  })().catch(console.error)
})

document.querySelector('#fontExamp')?.addEventListener('click', () => {
  ;(async () => {
    const fs = new FontSprite('font', '示例文字')
    await avCvs.spriteManager.addSprite(fs)
  })().catch(console.error)
})

let stopRecod = (): void => {}
document.querySelector('#startRecod')?.addEventListener('click', () => {
  ;(async () => {
    const fileHandle = await (window as any).showSaveFilePicker({
      suggestedName: `webav-recod-${Date.now()}.webm`,
      startIn: 'downloads'
    })
    stopRecod()
    stopRecod = startRecod(
      avCvs,
      await fileHandle.createWritable()
    )
  })().catch(console.error)
})
document.querySelector('#stopRecod')?.addEventListener('click', () => {
  stopRecod()
})

interface IWriter {
  seek: (pos: number) => void
  write: (blob: Blob) => void
  close: () => void
}

function startRecod (avCvs: AVCanvas, writer: IWriter): () => void {
  const recoder = new MediaRecorder(avCvs.captureStream(), {
    mimeType: 'video/webm;codecs=avc1.64001f,opus'
  })
  let firstBlob: Blob | null = null
  recoder.ondataavailable = (evt) => {
    if (firstBlob == null) firstBlob = evt.data
    console.log(44444, firstBlob.size)
    writer.write(evt.data)
  }
  const startTime = performance.now()
  recoder.onstop = async () => {
    if (firstBlob != null) {
      const duration = performance.now() - startTime
      const fixedBlob = await fixWebmDur(firstBlob, duration)
      console.log(3333, JSON.stringify({ duration, s1: firstBlob.size, s2: fixedBlob.size }))
      writer.seek(0)
      writer.write(fixedBlob)
    }
    writer.close()
  }
  recoder.start(1000)
  return () => {
    recoder.stop()
  }
}
