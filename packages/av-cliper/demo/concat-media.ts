import { AudioClip, ImgClip, MP4Clip } from '../src/clips'
import { Combinator } from '../src/combinator'
import { Log } from '../src/log'
import { OffscreenSprite } from '../src/offscreen-sprite'
import { renderTxt2ImgBitmap } from '../src/dom-utils'

const cvs = document.querySelector('canvas') as HTMLCanvasElement
const ctx = cvs.getContext('2d')!

document.querySelector('#mp4-mp4')?.addEventListener('click', () => {
  ;(async () => {
    const resp1 = await fetch('./public/0.mp4')
    const spr1 = new OffscreenSprite(
      'spr1',
      new MP4Clip(resp1.body as ReadableStream)
    )
    // 45°
    // spr1.rect.angle = Math.PI / 4
    const resp2 = await fetch('./public/fragment.mp4')
    const spr2 = new OffscreenSprite(
      'spr2',
      new MP4Clip(
        resp2.body as ReadableStream,
        { audio: { volume: 2 } } // 调整视频音量
      )
    )
    const resp3 = await fetch('./public/imgs/bangni.png')
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
    com.on('OutputProgress', v => {
      console.log('----- progress:', v)
    })
    await com.output().pipeTo(await createFileWriter('mp4'))
  })().catch(Log.error)
})

document.querySelector('#mp4-mp3')?.addEventListener('click', () => {
  ;(async () => {
    const resp1 = await fetch('./public/0.mp4')
    const spr1 = new OffscreenSprite(
      'spr1',
      new MP4Clip(resp1.body as ReadableStream)
    )

    const resp2 = await fetch('./public/audio/44.1kHz-2chan.mp3')
    const spr2 = new OffscreenSprite(
      'spr2',
      new AudioClip(await resp2.arrayBuffer(), {
        // volume: 2,
        loop: true
      })
    )
    const com = new Combinator({
      width: 1280,
      height: 720
    })
    await com.add(spr1, { offset: 0, duration: 35 })
    await com.add(spr2, { offset: 0, duration: 35 })
    await com.output().pipeTo(await createFileWriter('mp4'))
  })().catch(Log.error)
})

document.querySelector('#mix-m4a')?.addEventListener('click', () => {
  ;(async () => {
    const resp1 = await fetch('./public/44.1kHz-2chan.m4a')
    const resp2 = await fetch('./public/16kHz-1chan.mp3')
    const spr1 = new OffscreenSprite(
      '1',
      new AudioClip(await resp1.arrayBuffer(), { volume: 0.5 })
    )
    const spr2 = new OffscreenSprite(
      '2',
      new AudioClip(await resp2.arrayBuffer())
    )

    const com = new Combinator({
      width: 1280,
      height: 720
    })
    await com.add(spr1, { offset: 0, duration: 5 })
    await com.add(spr2, { offset: 0, duration: 3 })
    await com.output().pipeTo(await createFileWriter('mp4'))
  })().catch(Log.error)
})

document.querySelector('#gif-m4a')?.addEventListener('click', () => {
  ;(async () => {
    const resp1 = await fetch('./public/testgif.gif')
    const spr1 = new OffscreenSprite(
      's1',
      new ImgClip({ type: 'image/gif', stream: resp1.body! })
    )
    const resp2 = await fetch('./public/1kHz-2chan.m4a')
    const spr2 = new OffscreenSprite(
      's2',
      new AudioClip(await resp2.arrayBuffer())
    )
    const com = new Combinator({ width: 1280, height: 720 })
    await com.add(spr1, { duration: 10, offset: 0 })
    await com.add(spr2, { duration: 10, offset: 0 })
    await com.output().pipeTo(await createFileWriter('mp4'))
  })()
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
