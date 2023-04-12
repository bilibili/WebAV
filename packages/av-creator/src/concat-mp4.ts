import MyWorker from './concat-mp4-worker?worker&inline'

function download (fileName: string, data: ArrayBuffer | Blob): void {
  const url = window.URL.createObjectURL(new Blob([data]))
  const a = document.createElement('a')
  // Required in Firefox:
  document.body.appendChild(a)
  a.setAttribute('href', url)
  a.setAttribute('download', fileName)
  // Required in Firefox:
  a.setAttribute('target', '_self')
  a.click()
  window.URL.revokeObjectURL(url)
}

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
      console.log('>>>>> time cost: ', performance.now() - st)
      download('exp.mp4', evt.data.data)
    }
  })
}

export {}
