import { MP4Source } from '../src/mp4-source'
import { SourceGroup } from '../src/source-group'

document.querySelector('#concatMP4')?.addEventListener('click', () => {
  ;(async () => {
    const fhs = await (window as any).showOpenFilePicker({
      startIn: 'downloads',
      types: [
        {
          description: 'Video',
          accept: { 'video/*': ['.mp4'] }
        }
      ],
      multiple: true
    })

    console.time('cost')
    const sg = new SourceGroup()
    await Promise.all(fhs.map(async (fh: FileSystemFileHandle) => {
      const mp4Source = new MP4Source(new Response(await fh.getFile()).body as ReadableStream<Uint8Array>)
      await sg.add(mp4Source)
    }))
    sg.start()

    await sg.outputStream
      .pipeTo(await createFileWriter('mp4'))
    console.timeEnd('cost')
  })().catch(console.error)
})

document.querySelector('#extractMP4Samples')?.addEventListener('click', () => {
  ;(async () => {
    const fhs = await (window as any).showOpenFilePicker({
      startIn: 'downloads',
      types: [
        {
          description: 'Video',
          accept: { 'video/*': ['.mp4'] }
        }
      ],
      multiple: false
    })

    const mp4Source = new MP4Source(new Response(await fhs[0].getFile()).body as ReadableStream<Uint8Array>)

    console.log(await mp4Source.getInfo())
    const reader = mp4Source.stream.getReader()
    while (true) {
      const { done } = await reader.read()
      if (done) return
      // console.log('--- source stream: ', value)
    }
  })().catch(console.error)
})

async function createFileWriter (extName: string): Promise<FileSystemWritableFileStream> {
  const fileHandle = await window.showSaveFilePicker({
    suggestedName: `WebAv-export-${Date.now()}.${extName}`
  })
  return await fileHandle.createWritable()
}
