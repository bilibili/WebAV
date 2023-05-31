import { Log } from '../src/log'
import { fastConcatMP4, mixinMP4AndAudio } from '../src/mp4-utils'

document.querySelector('#fast-concat-mp4')?.addEventListener('click', () => {
  ;(async () => {
    const stream = fastConcatMP4([
      (await fetch('./public/video/webav1.mp4')).body!,
      (await fetch('./public/video/webav2.mp4')).body!,
      (await fetch('./public/video/webav3.mp4')).body!
    ])
    stream.pipeTo(await createFileWriter('mp4'))
  })().catch(Log.error)
})

document.querySelector('#mixin-mp4-audio')?.addEventListener('click', () => {
  ;(async () => {
    mixinMP4AndAudio((await fetch('./public/video/webav1.mp4')).body!, {
      stream: (await fetch('./public/audio/44.1kHz-2chan.mp3')).body!,
      volume: 1,
      loop: true
    }).pipeTo(await createFileWriter('mp4'))
  })().catch(Log.error)
})

document.querySelector('#concat-and-mixin')?.addEventListener('click', () => {
  ;(async () => {
    const mp4Stream = fastConcatMP4([
      (await fetch('./public/video/webav1.mp4')).body!,
      (await fetch('./public/video/webav2.mp4')).body!
    ])
    const mp43Stream = mixinMP4AndAudio(mp4Stream, {
      stream: (await fetch('./public/audio/44.1kHz-2chan.mp3')).body!,
      volume: 1,
      loop: false
    })
    mp43Stream.pipeTo(await createFileWriter('mp4'))
  })().catch(Log.error)
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
