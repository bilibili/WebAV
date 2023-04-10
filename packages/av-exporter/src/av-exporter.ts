import fixWebmDur from 'fix-webm-duration'

interface IWriter {
  seek: (pos: number) => void
  write: (blob: Blob) => void
  close: () => void
}

async function createFileWriter (): Promise<IWriter> {
  const fileHandle = await (window as any).showSaveFilePicker({
    suggestedName: 'webav-export-{Date.now()}.webm',
    startIn: 'downloads'
  })
  return await fileHandle.createWritable() as IWriter
}

/**
 * 导出 WebM 格式的视频，
 * 相较于 MediaRecorder 解决了视频 duration 问题
 * @param ms: MediaStream
 *  example: AVCanvas.captureStream()
 * @param recordOpts MediaRecorderOptions
 * @returns Promise<() => void> stop recording
 */
export async function exportWebM (
  ms: MediaStream,
  recordOpts: MediaRecorderOptions = {}
): Promise<() => void> {
  const recoder = new MediaRecorder(ms, {
    ...recordOpts,
    mimeType: 'video/webm;codecs=avc1.64001f,opus'
  })
  let firstBlob: Blob | null = null
  const writer = await createFileWriter()
  recoder.ondataavailable = (evt) => {
    if (firstBlob == null) firstBlob = evt.data
    writer.write(evt.data)
  }
  const startTime = performance.now()
  recoder.onstop = async () => {
    if (firstBlob != null) {
      const duration = performance.now() - startTime
      const fixedBlob = await fixWebmDur(firstBlob, duration)
      writer.seek(0)
      writer.write(fixedBlob)
    }
    writer.close()
  }
  recoder.start(1000)
  return () => {
    recoder.stop()
  }
}
