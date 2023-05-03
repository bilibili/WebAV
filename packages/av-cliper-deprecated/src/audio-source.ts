const audioCtx = new AudioContext()

export class AudioSoruce {
  #decodePromise

  constructor (arrBuf: ArrayBuffer) {
    this.#decodePromise = createAudioDataFromFile(arrBuf)
  }

  async getAudioData (): Promise<AudioData> {
    return await this.#decodePromise
  }
}

async function createAudioDataFromFile (arrBuf: ArrayBuffer): Promise<AudioData> {
  // todo: 可能很慢，且不适用大文件 https://github.com/soundcut/decode-audio-data-fast
  const audioBuf = await audioCtx.decodeAudioData(arrBuf)

  const frameCnt = audioBuf.sampleRate * audioBuf.duration * audioBuf.numberOfChannels
  const destBuf = new Float32Array(frameCnt)
  let offset = 0
  for (let i = 0; i < audioBuf.numberOfChannels; i++) {
    const chanBuf = audioBuf.getChannelData(i)
    destBuf.set(chanBuf, offset)
    offset += chanBuf.length
  }

  return new AudioData({
    numberOfChannels: audioBuf.numberOfChannels,
    numberOfFrames: frameCnt,
    sampleRate: audioBuf.sampleRate,
    timestamp: 0,
    format: 'f32-planar',
    data: destBuf
  })
}
