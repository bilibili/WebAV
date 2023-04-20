import mp4box, { AudioSampleDesc, AudioTrackOpts, MP4ArrayBuffer, MP4Box, MP4File, MP4Info, MP4Sample, VideoSampleDesc, VideoTrackOpts } from 'mp4box'

export class MP4Source {
  #mp4File = mp4box.createFile()

  sampleStream: ReadableStream<MP4Sample>

  #infoResolver: ((i: MP4Info) => void) | null = null
  #infoPromise = new Promise<MP4Info>((resolve) => {
    this.#infoResolver = resolve
  })

  constructor (rs: ReadableStream<Uint8Array>) {
    this.#mp4File.onReady = this.#onReady
    this.sampleStream = careateSampleStream(this.#mp4File, rs)
  }

  async getInfo (): Promise<MP4Info> {
    return await this.#infoPromise
  }

  #onReady = (info: MP4Info): void => {
    info.tracks.forEach(t => this.#mp4File.setExtractionOptions(
      t.id,
      null,
      { nbSamples: 5 }
    ))

    // Start demuxing.
    this.#mp4File.start()

    this.#infoResolver?.(info)

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
/**
 * mp4 demux，文件流 转 sample 流
 */
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

/**
 * mp4 mux，sample 转 文件流
 */
export function sampleStream2File (rs: ReadableStream<MP4Sample>): ReadableStream<ArrayBuffer> {
  const file = mp4box.createFile()

  let stoped = false
  const { stream, stop: stopStream } = convertFile2Stream(file, 500, () => {
    stoped = true
  })

  async function run (): Promise<void> {
    const reader = rs.getReader()

    const trackObj: Record<string, number> = {}
    function getTrackId (s: MP4Sample): number {
      const d = s.description as VideoSampleDesc & AudioSampleDesc
      const trackMark = `type:${d.type};width:${d.width ?? 0};height:${d.height ?? 0};samplerate:${d.samplerate};samplesize:${d.samplesize};`

      if (trackMark in trackObj) return trackObj[trackMark]

      const trackOpts = parseTrackOptsFromSample(s)
      const id = file.addTrack(trackOpts)
      trackObj[trackMark] = id

      return id
    }

    while (true) {
      const { done, value } = await reader.read()
      if (done || stoped) {
        stopStream()
        return
      }

      const id = getTrackId(value)
      file.addSample(id, value.data, {
        dts: value.dts,
        cts: value.cts,
        is_sync: value.is_sync,
        duration: value.duration
      })
    }
  }

  run().catch(console.error)

  return stream
}

function parseTrackOptsFromSample (s: MP4Sample): VideoTrackOpts | AudioTrackOpts {
  const d = s.description
  if ('width' in d) {
    return {
      timescale: s.timescale,
      width: d.width,
      height: d.height,
      // brands: string[]
      avcDecoderConfigRecord: d.avcC == null ? null : parseAvcCDecodeConfRecord(d.avcC)
    }
  } else {
    return {
      timescale: s.timescale,
      media_duration: 0,
      duration: 0,
      nb_samples: 0,
      samplerate: d.samplerate,
      channel_count: d.channel_count,
      samplesize: d.samplesize,
      width: 0,
      height: 0,
      hdlr: 'soun',
      name: 'SoundHandler',
      type: d.type
    }
  }
}

function convertFile2Stream (
  file: MP4File,
  timeSlice: number,
  onCancel: () => void
): {
    stream: ReadableStream<ArrayBuffer>
    stop: () => void
  } {
  let timerId = 0

  let sendedBoxIdx = 0
  const boxes = file.boxes
  const deltaBuf = (): ArrayBuffer => {
    const ds = new mp4box.DataStream()
    ds.endianness = mp4box.DataStream.BIG_ENDIAN
    for (let i = sendedBoxIdx; i < boxes.length; i++) {
      boxes[i].write(ds)
    }
    sendedBoxIdx = boxes.length
    return ds.buffer
  }

  let stoped = false
  let exit: (() => void) | null = null
  const stream = new ReadableStream({
    start (ctrl) {
      timerId = self.setInterval(() => {
        ctrl.enqueue(deltaBuf())
      }, timeSlice)

      exit = () => {
        clearInterval(timerId)
        file.flush()
        ctrl.enqueue(deltaBuf())
        ctrl.close()
      }

      // 安全起见，检测如果start触发时已经 stoped
      if (stoped) exit()
    },
    cancel () {
      clearInterval(timerId)
      onCancel()
    }
  })

  return {
    stream,
    stop: () => {
      stoped = true
      exit?.()
    }
  }
}

function parseAvcCDecodeConfRecord (avcCBox: MP4Box): ArrayBuffer {
  const stream = new mp4box.DataStream(
    undefined,
    0,
    mp4box.DataStream.BIG_ENDIAN
  )
  avcCBox.write(stream)
  return stream.buffer.slice(8) // Remove the box header.
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
