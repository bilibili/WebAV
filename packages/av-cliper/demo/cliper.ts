import { AudioSoruce } from '../src/audio-source'
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

document.querySelector('#concatMP3-4')?.addEventListener('click', () => {
  ;(async () => {
    const [mp40Resp, mp300Resp] = await Promise.all([
      fetch('./assets/0.mp4'),
      fetch('./assets/0-0.mp3')
    ])
    const mp4Src = new MP4Source(mp40Resp.body as ReadableStream<Uint8Array>)
    const audioSrc = new AudioSoruce(await mp300Resp.arrayBuffer())
    const sg = new SourceGroup()
    await sg.add(mp4Src)
    // await sg.add(audioSrc)
    console.log(11111, mp4Src, await audioSrc.getAudioData())
  })().catch(console.error)
})

async function createFileWriter (extName: string): Promise<FileSystemWritableFileStream> {
  // @ts-expect-error
  const fileHandle = await window.showSaveFilePicker({
    suggestedName: `WebAv-export-${Date.now()}.${extName}`
  })
  return await fileHandle.createWritable()
}
