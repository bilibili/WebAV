import { MP4Source, sampleStream2File } from '../src/mp4-source'

document.querySelector('#extractMP4')?.addEventListener('click', () => {
  ;(async () => {
    const [fh] = await (window as any).showOpenFilePicker({
      startIn: 'downloads',
      types: [
        {
          description: 'Video',
          accept: { 'video/*': ['.mp4'] }
        }
      ],
      multiple: true
    })

    const mp4Source = new MP4Source(new Response(await fh.getFile()).body as ReadableStream<Uint8Array>)

    await sampleStream2File(mp4Source.sampleStream)
      .pipeTo(await createFileWriter('mp4'))

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
