import mp4box, { MP4Sample } from 'mp4box'
import { Log } from '../src/log'
import { file2stream, parseVideoCodecDesc, stream2file } from '../src/mp4-utils'

async function demuxMP4 (
  stream: ReadableStream,
  opts: {
    onReady: (opts: { avcDecoderConfigRecord: Uint8Array }) => void
    onEnded: () => void
    onSamples: (type: 'video', samples: MP4Sample[]) => void
  }
) {
  const { file } = stream2file(stream)

  let endTimer = 0
  file.onSamples = (id, type, samples) => {
    console.log(4555, samples)
    opts.onSamples(type, samples)
    clearTimeout(endTimer)
    endTimer = setTimeout(() => {
      opts.onEnded()
    }, 300)
  }
  file.onReady = info => {
    console.log('demux info: ', info, info.videoTracks[0].id)
    opts.onReady({
      avcDecoderConfigRecord: parseVideoCodecDesc(
        file.getTrackById(info.videoTracks[0].id)
      )
    })
    file.setExtractionOptions(info.videoTracks[0].id, 'video')
    file.start()
  }
}

document.querySelector('#fast-concat-mp4')?.addEventListener('click', () => {
  ;(async () => {
    const outfile = mp4box.createFile()
    const { stream, stop } = file2stream(outfile, 500, () => {})
    stream.pipeTo(await createFileWriter('mp4'))

    const videoTrackOpts = {
      // 微秒
      timescale: 1e6,
      width: 1280,
      height: 720,
      brands: ['isom', 'iso2', 'avc1', 'mp42', 'mp41'],
      avcDecoderConfigRecord: null as AllowSharedBufferSource | undefined | null
    }

    let videoTrackId = -1
    let dts = 0
    let cts = 0
    await new Promise<void>(async resolve => {
      demuxMP4((await fetch('./public/video/webav1.mp4')).body!, {
        onReady: ({ avcDecoderConfigRecord }) => {
          videoTrackId = outfile.addTrack({
            ...videoTrackOpts,
            avcDecoderConfigRecord: avcDecoderConfigRecord.buffer
          })
        },
        onEnded: resolve,
        onSamples: (_, samples) => {
          samples.forEach(s => {
            dts = s.dts
            cts = s.cts
            outfile.addSample(videoTrackId, s.data, {
              duration: s.duration,
              dts: s.dts,
              cts: s.cts,
              is_sync: s.is_sync,
              description: s.description
            })
          })
        }
      })
    })
    await new Promise<void>(async resolve => {
      demuxMP4((await fetch('./public/video/webav2.mp4')).body!, {
        onReady: () => {},
        onEnded: resolve,
        onSamples: (_, samples) => {
          samples.forEach(s => {
            outfile.addSample(videoTrackId, s.data, {
              duration: s.duration,
              dts: s.dts + dts,
              cts: s.cts + cts,
              is_sync: s.is_sync,
              description: s.description
            })
          })
        }
      })
    })

    stop()
  })().catch(Log.error)
})

async function createFileWriter (
  extName: string
): Promise<FileSystemWritableFileStream> {
  // @ts-expect-error
  const fileHandle = await window.showSaveFilePicker({
    suggestedName: `WebAv-export-${Date.now()}.${extName}`
  })
  return fileHandle.createWritable()
}
