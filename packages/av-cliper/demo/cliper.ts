import { MP4Source } from '../src/mp4-source'

document.querySelector('#extractMP4')?.addEventListener('click', () => {
  ;(async () => {
    const [fh] = await (window as any).showOpenFilePicker({
      startIn: 'downloads',
      types: [
        {
          description: 'Video',
          accept: { 'video/*': ['.mp4'] }
        }
      ]
      // multiple: true
    })

    const mp4Source = new MP4Source(new Response(await fh.getFile()).body as ReadableStream<Uint8Array>)

    console.log(mp4Source)
    // const reader = mp4Source.sampleStream.getReader()
    // while (true) {
    //   const { done, value } = await reader.read()
    //   if (done) return
    //   console.log(9999, value)
    // }
  })().catch(console.error)
})
