import { demuxMP4Stream } from '../src/mp4-source'

document.querySelector('#decode-mp4')?.addEventListener('click', () => {
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

    const { stream, startDemux } = demuxMP4Stream(new Response(await fhs[0].getFile()).body as ReadableStream<Uint8Array>, (info) => {
      console.log('ready: ', info)
    })

    startDemux()
    const reader = stream.getReader()
    while (true) {
      const { done, value } = await reader.read()
      if (done) return
      console.log('----', value)
      value.close()
    }
  })().catch(console.error)
})
