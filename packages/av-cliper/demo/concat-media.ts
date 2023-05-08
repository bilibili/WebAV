import { AudioClip, ImgClip, MP4Clip } from '../src/clips'
import { Combinator } from '../src/combinator'
import { OffscreenSprite } from '../src/offscreen-sprite'
import { renderTxt2ImgBitmap } from '../src/utils'

// ;(async () => {
//   const img = await renderTxt2ImgBitmap('水印', `
//     font-size:40px; text-shadow: 2px 2px 6px red;
//   `)
//   const cvs = document.querySelector('canvas') as HTMLCanvasElement
//   const ctx = cvs.getContext('2d')
//   ctx?.drawImage(img, 0, 0)
// })().catch(console.error)

document.querySelector('#mp4-mp4')?.addEventListener('click', () => {
  ;(async () => {
    const resp1 = await fetch('./public/0.mp4')
    const spr1 = new OffscreenSprite(
      'v1',
      new MP4Clip(resp1.body as ReadableStream)
    )
    // 45°
    spr1.rect.angle = Math.PI / 4
    const resp2 = await fetch('./public/fragment.mp4')
    const spr2 = new OffscreenSprite(
      'v1',
      new MP4Clip(
        resp2.body as ReadableStream
        // { audio: false } // 禁止音频
      )
    )
    const resp3 = await fetch('./public/bangni.png')
    const spr3 = new OffscreenSprite(
      'spr3',
      new ImgClip(await createImageBitmap(await resp3.blob()))
    )
    spr3.setAnimation(
      {
        from: { angle: 0, x: 0, y: 0, opacity: 1 },
        to: { angle: Math.PI, x: 300, y: 300, opacity: 0 }
      },
      { duration: 3 }
    )

    const spr4 = new OffscreenSprite(
      'spr4',
      new ImgClip(
        await renderTxt2ImgBitmap(
          '水印',
          `
        font-size:40px; color: white; text-shadow: 2px 2px 6px red;
      `
        )
      )
    )
    spr4.setAnimation(
      {
        '0%': { x: 0, y: 0 },
        '25%': { x: 1200, y: 680 },
        '50%': { x: 1200, y: 0 },
        '75%': { x: 0, y: 680 },
        '100%': { x: 0, y: 0 }
      },
      { duration: 4, iterCount: 1 }
    )
    spr4.zIndex = 10
    spr4.opacity = 0.5

    const com = new Combinator({
      width: 1280,
      height: 720,
      bgColor: 'white'
    })
    await com.add(spr4, { offset: 0, duration: 5 })
    await com.add(spr1, { offset: 0, duration: 35 })
    await com.add(spr2, { offset: 38, duration: 7 })
    await com.add(spr3, { offset: 35, duration: 3 })
    await com.output().pipeTo(await createFileWriter('mp4'))
  })().catch(console.error)
})

document.querySelector('#mp4-mp3')?.addEventListener('click', () => {
  ;(async () => {
    const resp1 = await fetch('./public/0.mp4')
    const spr1 = new OffscreenSprite(
      'v1',
      new MP4Clip(resp1.body as ReadableStream)
    )

    const resp2 = await fetch('./public/0-4.mp3')
    const spr2 = new OffscreenSprite(
      'v1',
      new AudioClip(await resp2.arrayBuffer(), {
        numberOfChannels: 1,
        sampleRate: 48000,
        length: 4 * 48000
      })
    )
    const com = new Combinator({
      width: 1280,
      height: 720
    })
    await com.add(spr1, { offset: 0, duration: 35 })
    await com.add(spr2, { offset: 0, duration: 7 })
    await com.output().pipeTo(await createFileWriter('mp4'))
  })().catch(console.error)
})

const cvs = document.querySelector('#canvas') as HTMLCanvasElement
const ctx = cvs.getContext('2d') as CanvasRenderingContext2D
document.querySelector('#decode-frame')?.addEventListener('click', () => {
  ;(async () => {
    const resp1 = await fetch('./public/fragment.mp4')
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

async function createFileWriter (
  extName: string
): Promise<FileSystemWritableFileStream> {
  // @ts-expect-error
  const fileHandle = await window.showSaveFilePicker({
    suggestedName: `WebAv-export-${Date.now()}.${extName}`
  })
  return fileHandle.createWritable()
}
