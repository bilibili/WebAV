import MyWorker from './concat-mp4-worker?worker&inline'

export function concatMP4 (file1: File, file2: File): void {
  const rs1 = new Response(file1).body as ReadableStream<Uint8Array>
  const rs2 = new Response(file2).body as ReadableStream<Uint8Array>

  const worker = new MyWorker()
  worker.postMessage({
    type: 'concat-mp4',
    data: [
      rs1,
      rs2
    ]
  }, [
    rs1,
    rs2
  ])

  const st = performance.now()
  worker.addEventListener('message', (evt) => {
    if (evt.data.type === 'mp4-buffer') {
      const url = window.URL.createObjectURL(new Blob([evt.data.data]))
      const a = document.createElement('a')
      // Required in Firefox:
      document.body.appendChild(a)
      a.setAttribute('href', url)
      a.setAttribute('download', 'exp-mp4.mp4')
      // Required in Firefox:
      a.setAttribute('target', '_self')
      a.click()
      window.URL.revokeObjectURL(url)
      console.log('>>>>> time cost: ', performance.now() - st)
    }
  })
}

export {}
