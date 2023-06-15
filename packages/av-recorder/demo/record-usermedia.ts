import { AVRecorder } from '../src/av-recorder'

let recorder: AVRecorder | null = null
document.querySelector('#startRecod')?.addEventListener('click', () => {
  ;(async () => {
    const mediaStream = await navigator.mediaDevices.getUserMedia({
      video: true,
      audio: true
    })
    const recodeMS = mediaStream.clone()
    const vEl = document.querySelector('video') as HTMLVideoElement
    vEl.srcObject = mediaStream
    vEl.play().catch(console.error)

    recorder = new AVRecorder(recodeMS, {
      width: 1280,
      height: 720
    })
    await recorder.start()

    const writer = await createFileWriter('mp4')
    recorder.outputStream?.pipeTo(writer).catch(console.error)
  })().catch(console.error)
})
document.querySelector('#stopRecod')?.addEventListener('click', () => {
  ;(async () => {
    await recorder?.stop()
    alert('save done')
  })().catch(console.error)
})

async function createFileWriter (
  extName: string
): Promise<FileSystemWritableFileStream> {
  const fileHandle = await window.showSaveFilePicker({
    suggestedName: `WebAv-export-${Date.now()}.${extName}`
  })
  return fileHandle.createWritable()
}
