import mp4box from 'mp4box'

// Wraps an MP4Box File as a WritableStream underlying sink.
class MP4FileSink {
  #setStatus = null
  #file = null
  #offset = 0

  constructor (file, setStatus) {
    this.#file = file
    this.#setStatus = setStatus
  }

  write (chunk) {
    // MP4Box.js requires buffers to be ArrayBuffers, but we have a Uint8Array.
    const buffer = new ArrayBuffer(chunk.byteLength)
    new Uint8Array(buffer).set(chunk)

    // Inform MP4Box where in the file this chunk is from.
    buffer.fileStart = this.#offset
    this.#offset += buffer.byteLength

    // Append chunk.
    this.#setStatus('fetch', (this.#offset / (1024 ** 2)).toFixed(1) + ' MiB')
    this.#file.appendBuffer(buffer)
  }

  close () {
    this.#setStatus('fetch', 'Done')
    this.#file.flush()
  }
}

// Demuxes the first video track of an MP4 file using MP4Box, calling
// `onConfig()` and `onChunk()` with appropriate WebCodecs objects.
export class MP4Demuxer {
  #onConfig = null
  #onChunk = null
  #setStatus = null
  #file = null

  constructor (fileRS, { onConfig, onChunk, setStatus }) {
    this.#onConfig = onConfig
    this.#onChunk = onChunk
    this.#setStatus = setStatus

    // Configure an MP4Box File for demuxing.
    this.#file = mp4box.createFile()
    this.#file.onError = error => setStatus('demux', error)
    this.#file.onReady = this.#onReady.bind(this)
    this.#file.onSamples = this.#onSamples.bind(this)

    // Fetch the file and pipe the data through.
    const fileSink = new MP4FileSink(this.#file, setStatus)
    // highWaterMark should be large enough for smooth streaming, but lower is
    // better for memory usage.
    // eslint-disable-next-line
    fileRS.pipeTo(new WritableStream(fileSink, { highWaterMark: 20 }))
  }

  // Get the appropriate `description` for a specific track. Assumes that the
  // track is H.264 or H.265.
  #description (track) {
    const trak = this.#file.getTrackById(track.id)
    for (const entry of trak.mdia.minf.stbl.stsd.entries) {
      if (entry.avcC || entry.hvcC) {
        const stream = new mp4box.DataStream(undefined, 0, mp4box.DataStream.BIG_ENDIAN)
        if (entry.avcC) {
          entry.avcC.write(stream)
        } else {
          entry.hvcC.write(stream)
        }
        return new Uint8Array(stream.buffer, 8) // Remove the box header.
      }
    }
    throw Error('avcC or hvcC not found')
  }

  #onReady (info) {
    this.#setStatus('demux', 'Ready')
    console.log('---- onReady', info)
    const track = info.videoTracks[0]

    // Generate and emit an appropriate VideoDecoderConfig.
    this.#onConfig({
      codec: track.codec,
      codedHeight: track.video.height,
      codedWidth: track.video.width,
      description: this.#description(track),
      duration: info.duration
    })

    // Start demuxing.
    this.#file.setExtractionOptions(track.id)
    this.#file.start()
  }

  #onSamples (trackId, ref, samples) {
    // Generate and emit an EncodedVideoChunk for each demuxed sample.
    for (const sample of samples) {
      // console.log(888888, sample)
      this.#onChunk(new EncodedVideoChunk({
        type: sample.is_sync ? 'key' : 'delta',
        timestamp: 1e6 * sample.cts / sample.timescale,
        duration: 1e6 * sample.duration / sample.timescale,
        data: sample.data
      }))
    }
  }
}
