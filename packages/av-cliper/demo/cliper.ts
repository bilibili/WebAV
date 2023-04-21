import { MP4Source, sampleStream2File } from '../src/mp4-source'
import { SourceGroup } from '../src/source-group'

document.querySelector('#extractMP4')?.addEventListener('click', () => {
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

    const sg = new SourceGroup()
    await Promise.all(fhs.map(async (fh: FileSystemFileHandle) => {
      const mp4Source = new MP4Source(new Response(await fh.getFile()).body as ReadableStream<Uint8Array>)
      sg.add(mp4Source.sampleStream)
    }))
    sg.start()

    await sampleStream2File(sg.outputStream)
      .pipeTo(await createFileWriter('mp4'))

    // await sampleStream2File(mp4Source.sampleStream)
    // .pipeTo(await createFileWriter('mp4'))

    // console.log(await mp4Source.getInfo())
    // const reader = mp4Source.sampleStream.getReader()
    // while (true) {
    //   const { done, value } = await reader.read()
    //   if (done) return
    //   console.log(9999, value)
    // }
  })().catch(console.error)
})

async function createFileWriter (extName: string): Promise<FileSystemWritableFileStream> {
  const fileHandle = await window.showSaveFilePicker({
    suggestedName: `WebAv-export-${Date.now()}.${extName}`
  })
  return await fileHandle.createWritable()
}
