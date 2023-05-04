import { AudioClip, ImgClip, MP4Clip } from '../src/cliper/clips'
import { Timeline } from '../src/cliper/time-line'
import { WorkerSprite } from '../src/cliper/worker-sprite'

document.querySelector('#mp4-mp4')?.addEventListener('click', () => {
  ;(async () => {
    const resp1 = await fetch('./public/0.mp4')
    const spr1 = new WorkerSprite(
      'v1',
      new MP4Clip(resp1.body as ReadableStream)
    )
    // 45°
    spr1.rect.angle = Math.PI / 4
    const resp2 = await fetch('./public/fragment.mp4')
    const spr2 = new WorkerSprite(
      'v1',
      new MP4Clip(resp2.body as ReadableStream)
    )
    const resp3 = await fetch('./public/bangni.png')
    const spr3 = new WorkerSprite(
      'i1',
      new ImgClip(await createImageBitmap(await resp3.blob()))
    )
    spr3.rect.setAnimation({
      from: { angle: 0, x: 0 },
      to: { angle: Math.PI, x: 100 }
    }, { duration: 3 })

    const timeline = new Timeline({
      width: 1280,
      height: 720
    })
    await timeline.add(spr1, { offset: 0, duration: 35 })
    await timeline.add(spr2, { offset: 38, duration: 7 })
    await timeline.add(spr3, { offset: 35, duration: 3 })
    await timeline.output().pipeTo(await createFileWriter('mp4'))
  })().catch(console.error)
})

document.querySelector('#mp4-mp3')?.addEventListener('click', () => {
  ;(async () => {
    const resp1 = await fetch('./assets/0.mp4')
    const spr1 = new WorkerSprite(
      'v1',
      new MP4Clip(resp1.body as ReadableStream)
    )

    const resp2 = await fetch('./assets/0-4.mp3')
    const spr2 = new WorkerSprite(
      'v1',
      new AudioClip(await resp2.arrayBuffer(), {
        numberOfChannels: 1,
        sampleRate: 48000,
        length: 4 * 48000
      })
    )
    const timeline = new Timeline({
      width: 1280,
      height: 720
    })
    await timeline.add(spr1, {
      offset: 0 * 1e6,
      duration: 35 * 1e6
    })
    await timeline.add(spr2, {
      offset: 0 * 1e6,
      duration: 7 * 1e6
    })
    await timeline.output().pipeTo(await createFileWriter('mp4'))
  })().catch(console.error)
})

const cvs = document.querySelector('#canvas') as HTMLCanvasElement
const ctx = cvs.getContext('2d') as CanvasRenderingContext2D
document.querySelector('#decode-frame')?.addEventListener('click', () => {
  ;(async () => {
    const resp1 = await fetch('./assets/fragment.mp4')
    const clip = new MP4Clip(resp1.body as ReadableStream)
    await clip.ready
    let time = 0
    while (true) {
      const { state, video } = await clip.tick(time)
      if (state === 'done') return
      if (video != null && state === 'success') {
        ctx.drawImage(video, 0, 0, video.codedWidth, video.codedHeight)
        video.close()
      }
      time += 40000
    }
  })().catch(console.error)
})

async function createFileWriter (extName: string): Promise<FileSystemWritableFileStream> {
  // @ts-expect-error
  const fileHandle = await window.showSaveFilePicker({
    suggestedName: `WebAv-export-${Date.now()}.${extName}`
  })
  return fileHandle.createWritable()
}
