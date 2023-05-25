import { Log } from '../src/log'
import { fastConcatMP4 } from '../src/mp4-utils'

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

async function createFileWriter (
  extName: string
): Promise<FileSystemWritableFileStream> {
  // @ts-expect-error
  const fileHandle = await window.showSaveFilePicker({
    suggestedName: `WebAv-export-${Date.now()}.${extName}`
  })
  return fileHandle.createWritable()
}
