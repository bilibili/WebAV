import fixWebmDur from 'fix-webm-duration'

/**
 * 导出 WebM 格式的视频，
 * 相较于 MediaRecorder 解决了视频 duration 问题
 * @param inputMediaStream: MediaStream
 *  example: AVCanvas.captureStream()
 * @param recordOpts MediaRecorderOptions
 * @returns Promise<() => void> stop recording
 */
export async function exportWebM (
  inputMediaStream: MediaStream,
  outputWriter: FileSystemWritableFileStream,
  recordOpts: MediaRecorderOptions = {}
): Promise<() => void> {
  const recoder = new MediaRecorder(inputMediaStream, {
    ...recordOpts,
    mimeType: 'video/webm;codecs=avc1.64001f,opus'
  })
  let firstBlob: Blob | null = null
  recoder.ondataavailable = (evt) => {
    if (firstBlob == null) firstBlob = evt.data
    outputWriter.write(evt.data)
  }
  const startTime = performance.now()
  recoder.onstop = async () => {
    if (firstBlob != null) {
      const duration = performance.now() - startTime
      const fixedBlob = await fixWebmDur(firstBlob, duration)
      outputWriter.seek(0)
      outputWriter.write(fixedBlob)
    }
    outputWriter.close()
  }
  recoder.start(1000)
  return () => {
    recoder.stop()
  }
}
