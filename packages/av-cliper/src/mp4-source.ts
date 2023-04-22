import mp4box, { MP4ArrayBuffer, MP4Info, TrakBoxParser } from 'mp4box'

export class MP4Source {
  stream: ReadableStream<VideoFrame | AudioData>

  #infoResolver: ((i: MP4Info) => void) | null = null
  #infoPromise = new Promise<MP4Info>((resolve) => {
    this.#infoResolver = resolve
  })

  constructor (rs: ReadableStream<Uint8Array>) {
    this.stream = careateVideoFrameStream(rs, (info) => {
      this.#infoResolver?.(info)
    })
  }

  async getInfo (): Promise<MP4Info> {
    return await this.#infoPromise
  }
}
/**
 * mp4 demux，文件流 转 VideoFrame 流
 */
function careateVideoFrameStream (
  rs: ReadableStream<Uint8Array>,
  onReady: (info: MP4Info) => void
): ReadableStream<VideoFrame | AudioData> {
  let ctrlCnt = 0
  let ctrl: ReadableStreamDefaultController<VideoFrame | AudioData> | null = null
  const vd = new VideoDecoder({
    output: (vf) => {
      ctrl?.enqueue(vf)
      ctrlCnt += 1
    },
    error: console.error
  })
  const ad = new AudioDecoder({
    output: (audioData) => {
      ctrl?.enqueue(audioData)
      ctrlCnt += 1
    },
    error: console.error
  })

  const mp4File = mp4box.createFile()
  mp4File.onReady = (info) => {
    onReady(info)

    const vTrackInfo = info.videoTracks[0]
    if (vTrackInfo != null) {
      const vTrack = mp4File.getTrackById(vTrackInfo.id)
      // Generate and emit an appropriate VideoDecoderConfig.
      const vdConf = {
        codec: vTrackInfo.codec,
        codedHeight: vTrackInfo.video.height,
        codedWidth: vTrackInfo.video.width,
        description: parseVideoCodecDesc(vTrack),
        duration: info.duration
      }
      vd.configure(vdConf)
      mp4File.setExtractionOptions(vTrackInfo.id, 'video')
    }

    const aTrackInfo = info.audioTracks[0]
    if (aTrackInfo != null) {
      // Generate and emit an appropriate VideoDecoderConfig.
      const adConf = {
        // description: trak.mdia.minf.stbl.stsd.entries[0].esds.esd.descs[0].descs[0].data;
        codec: aTrackInfo.codec === 'mp4a' ? 'mp4a.40.2' : aTrackInfo.codec,
        numberOfChannels: aTrackInfo.audio.channel_count,
        sampleRate: aTrackInfo.audio.sample_rate
      }
      ad.configure(adConf)
      mp4File.setExtractionOptions(aTrackInfo.id, 'audio')
    }

    mp4File.start()
  }

  mp4File.onSamples = (_, sampleType: 'video' | 'audio', samples) => {
    if (sampleType === 'video') {
      samples.forEach(s => vd.decode(new EncodedVideoChunk({
        type: s.is_sync ? 'key' : 'delta',
        timestamp: 1e6 * s.cts / s.timescale,
        duration: 1e6 * s.duration / s.timescale,
        data: s.data
      })))
    } else if (sampleType === 'audio') {
      samples.forEach(s => ad.decode(new EncodedAudioChunk({
        type: s.is_sync ? 'key' : 'delta',
        timestamp: 1e6 * s.cts / s.timescale,
        duration: 1e6 * s.duration / s.timescale,
        data: s.data
      })))
    }
  }

  let chunkOffset = 0
  const reader = rs.getReader()
  let inputDone = false
  return new ReadableStream({
    start: (c) => {
      ctrl = c
    },
    pull: async (ctrl) => {
      while (ctrl.desiredSize != null && ctrl.desiredSize >= 0) {
        const { done, value } = await reader.read()
        if (done) {
          if (!inputDone) {
            // firt emit done
            const last = ctrlCnt
            const timerId = setInterval(() => {
              if (ctrlCnt !== last) return
              clearInterval(timerId)
              ctrl.close()
              mp4File.stop()
            }, 300)
          }
          inputDone = true
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
// function sampleStream2File (rs: ReadableStream<MP4Sample>): ReadableStream<ArrayBuffer> {
//   const file = mp4box.createFile()

//   let stoped = false
//   const { stream, stop: stopStream } = convertFile2Stream(file, 500, () => {
//     stoped = true
//   })

//   async function run (): Promise<void> {
//     const reader = rs.getReader()

//     const trackObj: Record<string, number> = {}
//     function getTrackId (s: MP4Sample): number {
//       const d = s.description as VideoSampleDesc & AudioSampleDesc
//       const trackMark = `type:${d.type}`

//       if (trackMark in trackObj) return trackObj[trackMark]

//       const trackOpts = parseTrackOptsFromSample({ ...s, timescale: 1e6 })
//       const id = file.addTrack(trackOpts)
//       trackObj[trackMark] = id

//       console.log(111111, trackOpts, s)

//       return id
//     }

//     while (true) {
//       const { done, value } = await reader.read()
//       if (done || stoped) {
//         stopStream()
//         return
//       }

//       const id = getTrackId(value)
//       file.addSample(id, value.data, {
//         dts: value.dts / value.timescale * 1e6,
//         cts: value.cts / value.timescale * 1e6,
//         is_sync: value.is_sync,
//         duration: value.duration / value.timescale * 1e6
//       })
//     }
//   }

//   run().catch(console.error)

//   return stream
// }

// function parseTrackOptsFromSample (s: MP4Sample): VideoTrackOpts | AudioTrackOpts {
//   const d = s.description
//   if ('width' in d) {
//     return {
//       timescale: s.timescale,
//       width: d.width,
//       height: d.height,
//       brands: ['isom', 'iso2', 'avc1', 'mp41'],
//       avcDecoderConfigRecord: d.avcC == null ? null : parseAvcCDecodeConfRecord(d.avcC)
//     }
//   } else {
//     return {
//       timescale: s.timescale,
//       media_duration: 0,
//       duration: 0,
//       nb_samples: 0,
//       samplerate: d.samplerate,
//       channel_count: d.channel_count,
//       samplesize: d.samplesize,
//       width: 0,
//       height: 0,
//       hdlr: 'soun',
//       name: 'SoundHandler',
//       type: d.type
//     }
//   }
// }

// function convertFile2Stream (
//   file: MP4File,
//   timeSlice: number,
//   onCancel: () => void
// ): {
//     stream: ReadableStream<ArrayBuffer>
//     stop: () => void
//   } {
//   let timerId = 0

//   let sendedBoxIdx = 0
//   const boxes = file.boxes
//   const deltaBuf = (): ArrayBuffer => {
//     const ds = new mp4box.DataStream()
//     ds.endianness = mp4box.DataStream.BIG_ENDIAN
//     for (let i = sendedBoxIdx; i < boxes.length; i++) {
//       boxes[i].write(ds)
//     }
//     sendedBoxIdx = boxes.length
//     return ds.buffer
//   }

//   let stoped = false
//   let exit: (() => void) | null = null
//   const stream = new ReadableStream({
//     start (ctrl) {
//       timerId = self.setInterval(() => {
//         ctrl.enqueue(deltaBuf())
//       }, timeSlice)

//       exit = () => {
//         clearInterval(timerId)
//         file.flush()
//         ctrl.enqueue(deltaBuf())
//         ctrl.close()
//       }

//       // 安全起见，检测如果start触发时已经 stoped
//       if (stoped) exit()
//     },
//     cancel () {
//       clearInterval(timerId)
//       onCancel()
//     }
//   })

//   return {
//     stream,
//     stop: () => {
//       stoped = true
//       exit?.()
//     }
//   }
// }

// function parseAvcCDecodeConfRecord (avcCBox: MP4Box): ArrayBuffer {
//   const stream = new mp4box.DataStream(
//     undefined,
//     0,
//     mp4box.DataStream.BIG_ENDIAN
//   )
//   avcCBox.write(stream)
//   return stream.buffer.slice(8) // Remove the box header.
// }

// track is H.264 or H.265.
function parseVideoCodecDesc (track: TrakBoxParser): Uint8Array {
  for (const entry of track.mdia.minf.stbl.stsd.entries) {
    if ('avcC' in entry || 'hvcC ' in entry) {
      const stream = new mp4box.DataStream(
        undefined,
        0,
        mp4box.DataStream.BIG_ENDIAN
      )
      // @ts-expect-error
      const box = 'avcC' in entry ? entry.avcC : entry.hvcC
      box.write(stream)
      return new Uint8Array(stream.buffer, 8) // Remove the box header.
    }
  }
  throw Error('avcC or hvcC not found')
}
