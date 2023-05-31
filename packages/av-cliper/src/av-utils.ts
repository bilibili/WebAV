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
 * 从 AudioData 中提取 PCM 数据
 */
export function extractPCM4AudioData (ad: AudioData): Float32Array[] {
  return Array(ad.numberOfChannels)
    .fill(0)
    .map((_, idx) => {
      const chanBufSize = ad.allocationSize({ planeIndex: idx })
      const chanBuf = new ArrayBuffer(chanBufSize)
      ad.copyTo(chanBuf, { planeIndex: idx })
      return new Float32Array(chanBuf)
    })
}

/**
 * 从 AudioBuffer 中提取 PCM
 */
export function extractPCM4AudioBuffer (ab: AudioBuffer): Float32Array[] {
  return Array(ab.numberOfChannels)
    .fill(0)
    .map((_, idx) => {
      return ab.getChannelData(idx)
    })
}

export function adjustAudioDataVolume (ad: AudioData, volume: number) {
  const data = new Float32Array(
    concatFloat32Array(extractPCM4AudioData(ad))
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

export async function decodeImg (
  stream: ReadableStream<Uint8Array>,
  type: string
): Promise<VideoFrame[]> {
  const init = {
    type,
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

/**
 * 混合双通道音轨的 PCM 数据，并将多声道并排成一个 Float32Array 输出
 */
export function mixPCM (audios: Float32Array[][]): Float32Array {
  const maxLen = Math.max(...audios.map(a => a[0]?.length ?? 0))
  const data = new Float32Array(maxLen * 2)

  for (let bufIdx = 0; bufIdx < maxLen; bufIdx++) {
    let chan0 = 0
    let chan1 = 0
    for (let trackIdx = 0; trackIdx < audios.length; trackIdx++) {
      chan0 += audios[trackIdx][0]?.[bufIdx] ?? 0
      chan1 += audios[trackIdx][1]?.[bufIdx] ?? chan0
    }
    data[bufIdx] = chan0
    data[bufIdx + maxLen] = chan1
  }

  return data
}

/**
 * 音频 PCM 重采样
 * @param pcmData PCM
 * @param curRate 当前采样率
 * @param target { reate: 目标采样率, chanCount: 目标声道数 }
 * @returns PCM
 */
export async function audioResample (
  pcmData: Float32Array[],
  curRate: number,
  target: {
    rate: number
    chanCount: number
  }
): Promise<Float32Array[]> {
  const chanCnt = pcmData.length
  const emptyPCM = Array(target.chanCount)
    .fill(0)
    .map(() => new Float32Array(0))
  if (chanCnt === 0) return emptyPCM

  const len = Math.max(...pcmData.map(c => c.length))
  if (len === 0) return emptyPCM

  const ctx = new OfflineAudioContext(
    target.chanCount,
    (len * target.rate) / curRate,
    target.rate
  )
  const abSource = ctx.createBufferSource()
  const ab = ctx.createBuffer(chanCnt, len, curRate)
  pcmData.forEach((d, idx) => ab.copyToChannel(d, idx))

  abSource.buffer = ab
  abSource.connect(ctx.destination)
  abSource.start()

  return extractPCM4AudioBuffer(await ctx.startRendering())
}

export function sleep (time: number): Promise<void> {
  return new Promise(resolve => {
    setTimeout(resolve, time)
  })
}

/**
 *  循环 即 环形取值，主要用于截取 PCM
 */
export function ringSliceFloat32Array (
  data: Float32Array,
  start: number,
  end: number
): Float32Array {
  const cnt = end - start
  const rs = new Float32Array(cnt)
  let i = 0
  while (i < cnt) {
    rs[i] = data[(start + i) % data.length]
    i += 1
  }
  return rs
}

export function autoReadStream<ST extends ReadableStream> (
  stream: ST,
  cbs: {
    onChunk: ST extends ReadableStream<infer DT> ? (chunk: DT) => void : never
    onDone: () => void
  }
) {
  const reader = stream.getReader()
  async function run () {
    while (true) {
      const { value, done } = await reader.read()
      if (done) {
        cbs.onDone()
        return
      }
      cbs.onChunk(value)
    }
  }

  run().catch(err => {
    throw err
  })
}
