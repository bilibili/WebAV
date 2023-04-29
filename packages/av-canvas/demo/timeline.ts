import { Timeline } from '../src/sprites/time-line'
import { MP4DataSource, WorkerSprite } from '../src/sprites/worker-sprite'

document.querySelector('#start')?.addEventListener('click', () => {
  ;(async () => {
    const resp1 = await fetch('./assets/0.mp4')
    const spr1 = new WorkerSprite(
      'v1',
      new MP4DataSource(resp1.body as ReadableStream)
    )
    // 45°
    spr1.rect.angle = Math.PI / 4
    const resp2 = await fetch('./assets/fragment.mp4')
    const spr2 = new WorkerSprite(
      'v1',
      new MP4DataSource(resp2.body as ReadableStream)
    )
    const timeline = new Timeline({
      width: 1280,
      height: 720
    })
    await timeline.add(spr2, {
      offset: 0 * 1e6,
      duration: 7 * 1e6
    })
    await timeline.add(spr1, {
      offset: 7 * 1e6,
      duration: 40 * 1e6
    })
    await timeline.output().pipeTo(await createFileWriter('mp4'))
  })().catch(console.error)
})

const cvs = document.querySelector('#canvas') as HTMLCanvasElement
const ctx = cvs.getContext('2d') as CanvasRenderingContext2D
document.querySelector('#decode-frame')?.addEventListener('click', () => {
  ;(async () => {
    const resp1 = await fetch('./assets/fragment.mp4')
    const ds = new MP4DataSource(resp1.body as ReadableStream)
    await ds.ready
    let time = 0
    while (true) {
      const { state, video } = await ds.tick(time)
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
