import fixWebmDur from "fix-webm-duration";

/**
 * 导出 WebM 格式的视频，
 * 相较于 MediaRecorder 解决了视频 duration 问题
 * @param inputMediaStream: MediaStream
 *  example: AVCanvas.captureStream()
 * @param recordOpts MediaRecorderOptions
 * @returns Promise<() => void> stop recording
 */
export async function exportWebM(
  inputMediaStream: MediaStream,
  outputWriter: FileSystemWritableFileStream,
  recordOpts: MediaRecorderOptions = {},
): Promise<() => void> {
  const recoder = new MediaRecorder(inputMediaStream, {
    ...recordOpts,
    mimeType: "video/webm;codecs=avc1.64001f,opus",
  });
  let firstBlob: Blob | null = null;
  recoder.ondataavailable = async (evt) => {
    if (firstBlob == null) firstBlob = evt.data;
    await outputWriter.write(evt.data);
  };
  const startTime = performance.now();
  recoder.onstop = async () => {
    if (firstBlob != null) {
      const duration = performance.now() - startTime;
      const fixedBlob = await fixWebmDur(firstBlob, duration);
      await outputWriter.seek(0);
      // fixme: fixedBlob.size not equal firstBlob.size
      await outputWriter.write(fixedBlob);
    }
    await outputWriter.close();
  };
  recoder.start(1000);
  return () => {
    recoder.stop();
  };
}
