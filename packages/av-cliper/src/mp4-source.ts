import mp4box, { MP4Info, MP4MediaTrack, MP4Sample } from 'mp4box'

export class MP4Source {
  // #samplePool: MP4Sample[] = []
  // #maxSampleCnt = 1000

  #mp4File = mp4box.createFile()

  #chunkOffset = 0

  #mp4Info: MP4Info | null = null

  #reader: ReadableStreamDefaultReader<Uint8Array>

  #demuxing = false

  constructor (rs: ReadableStream<Uint8Array>, opts: {
    onSamples: () => void
  }) {
    this.#reader = rs.getReader()
    this.#mp4File.onReady = this.#onReady
    // this.#mp4File.onSamples = this.#onSamples
    this.#mp4File.onSamples = opts.onSamples
  }

  async #demux (): Promise<void> {
    // while (this.#samplePool.length < this.#maxSampleCnt) {
    while (this.#demuxing) {
      const { done, value } = await this.#reader.read()
      if (done) {
        this.#demuxing = false
        return
      }

      const chunk = value as Uint8Array & { fileStart: number }
      chunk.fileStart = this.#chunkOffset
      this.#chunkOffset += chunk.byteLength
      this.#mp4File.appendBuffer(chunk)
    }
  }

  #onReady (info: MP4Info): void {
    this.#mp4Info = info
    info.tracks.forEach(t => this.#mp4File.setExtractionOptions(t.id))

    this.#demuxing = true
    // Start demuxing.
    this.#mp4File.start()
    this.#demux().catch(console.error)

    // Generate and emit an appropriate VideoDecoderConfig.
    // this.#onConfig({
    //   codec: track.codec,
    //   codedHeight: track.video.height,
    //   codedWidth: track.video.width,
    //   description: this.#description(track),
    //   duration: info.duration
    // })
  }

  #onSamples (_: number, __: unknown, samples: MP4Sample[]): void {
    // this.#samplePool = this.#samplePool.concat(samples)
  }

  // Get the appropriate `description` for a specific track. Assumes that the
  // track is H.264 or H.265.
  #description (track: MP4MediaTrack): Uint8Array {
    // const trak = this.#mp4File.getTrackById(track.id)
    for (const entry of track.mdia.minf.stbl.stsd.entries) {
      if (entry.avcC != null || entry.hvcC != null) {
        const stream = new mp4box.DataStream(
          undefined,
          0,
          mp4box.DataStream.BIG_ENDIAN
        )
        if (entry.avcC != null) {
          entry.avcC.write(stream)
        } else {
          entry.hvcC.write(stream)
        }
        return new Uint8Array(stream.buffer, 8) // Remove the box header.
      }
    }
    throw Error('avcC or hvcC not found')
  }
}
