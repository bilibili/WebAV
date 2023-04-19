import mp4box, { MP4ArrayBuffer, MP4File, MP4Info, MP4Sample } from 'mp4box'

export class MP4Source {
  #mp4File = mp4box.createFile()

  sampleStream: ReadableStream<MP4Sample>

  constructor (rs: ReadableStream<Uint8Array>) {
    this.#mp4File.onReady = this.#onReady
    this.sampleStream = careateSampleStream(this.#mp4File, rs)
  }

  #onReady = (info: MP4Info): void => {
    console.log(1111111, info)
    info.tracks.forEach(t => this.#mp4File.setExtractionOptions(t.id))

    // Start demuxing.
    this.#mp4File.start()

    // Generate and emit an appropriate VideoDecoderConfig.
    // this.#onConfig({
    //   codec: track.codec,
    //   codedHeight: track.video.height,
    //   codedWidth: track.video.width,
    //   description: this.#description(track),
    //   duration: info.duration
    // })
  }
}

function careateSampleStream (mp4File: MP4File, rs: ReadableStream<Uint8Array>): ReadableStream {
  let chunkOffset = 0
  const reader = rs.getReader()
  return new ReadableStream({
    start: (ctrl) => {
      mp4File.onSamples = (_, __, samples) => {
        samples.forEach(s => ctrl.enqueue(s))
      }
    },
    pull: async (ctrl) => {
      while (ctrl.desiredSize != null && ctrl.desiredSize >= 0) {
        const { done, value } = await reader.read()
        if (done) {
          ctrl.close()
          return
        }

        const chunk = value.buffer as MP4ArrayBuffer
        chunk.fileStart = chunkOffset
        chunkOffset += chunk.byteLength
        mp4File.appendBuffer(chunk)
      }
    }
  }, { highWaterMark: 100 })
}

// track is H.264 or H.265.
// function parseVideoCodecdesc (track: MP4MediaTrack): Uint8Array {
//   // const trak = this.#mp4File.getTrackById(track.id)
//   for (const entry of track.mdia.minf.stbl.stsd.entries) {
//     if (entry.avcC != null || entry.hvcC != null) {
//       const stream = new mp4box.DataStream(
//         undefined,
//         0,
//         mp4box.DataStream.BIG_ENDIAN
//       )
//       if (entry.avcC != null) {
//         entry.avcC.write(stream)
//       } else {
//         entry.hvcC.write(stream)
//       }
//       return new Uint8Array(stream.buffer, 8) // Remove the box header.
//     }
//   }
//   throw Error('avcC or hvcC not found')
// }
