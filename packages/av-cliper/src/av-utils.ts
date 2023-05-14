// 能同时在 worker 和主线程中运行的工具函数

export function concatFloat32Array (bufs: Float32Array[]): Float32Array {
  const rs = new Float32Array(
    bufs.map(buf => buf.length).reduce((a, b) => a + b)
  )

  let offset = 0
  for (const buf of bufs) {
    rs.set(buf, offset)
    offset += buf.length
  }

  return rs
}

/**
 * 提取各个声道的 buffer 数据
 */
export function extractAudioDataBuf (ad: AudioData): Float32Array[] {
  const bufs: ArrayBuffer[] = []
  for (let i = 0; i < ad.numberOfChannels; i++) {
    const chanBufSize = ad.allocationSize({ planeIndex: i })
    const chanBuf = new ArrayBuffer(chanBufSize)
    ad.copyTo(chanBuf, { planeIndex: i })
    bufs.push(chanBuf)
  }

  return bufs.map(b => new Float32Array(b))
}

export function adjustAudioDataVolume (ad: AudioData, volume: number) {
  const data = new Float32Array(
    concatFloat32Array(extractAudioDataBuf(ad))
  ).map(v => v * volume)
  const newAd = new AudioData({
    sampleRate: ad.sampleRate,
    numberOfChannels: ad.numberOfChannels,
    timestamp: ad.timestamp,
    format: ad.format,
    numberOfFrames: ad.numberOfFrames,
    data
  })
  ad.close()
  return newAd
}

export async function decodeGif (
  stream: ReadableStream<Uint8Array>
): Promise<VideoFrame[]> {
  const init = {
    type: 'image/gif',
    data: stream
  }

  const imageDecoder = new ImageDecoder(init)
  const rs: VideoFrame[] = []
  const { image, complete } = await imageDecoder.decode({ frameIndex: 0 })
  rs.push(image)

  let frameCnt = imageDecoder.tracks.selectedTrack?.frameCount ?? 1
  if (complete && frameCnt === 1) return rs

  let i = 1
  while (i < frameCnt) {
    const { image } = await imageDecoder.decode({ frameIndex: i })
    // frameCnt 可能会逐渐增加
    frameCnt = imageDecoder.tracks.selectedTrack?.frameCount ?? i
    i += 1
    rs.push(image)
  }
  return rs
}
