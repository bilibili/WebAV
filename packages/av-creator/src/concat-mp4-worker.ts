import mp4box, { MP4File } from 'mp4box'
import { MP4Demuxer } from './mp4-demuxer.js'

const cvs = new OffscreenCanvas(1280, 720)
const ctx = cvs.getContext('2d')

let v1Ready = Promise.resolve()
self.onmessage = (evt: MessageEvent) => {
  console.log('woker', evt.data)
  let v1Duration = 0
  if (evt.data.type === 'concat-mp4') {
    const [fileRS1, fileRS2] = evt.data.data
    let d1: VideoDecoder | null = null
    // eslint-disable-next-line
    new MP4Demuxer(fileRS1, {
      onConfig (conf: VideoDecoderConfig & { duration: number }) {
        // console.log(1111, 'config', conf)
        v1Duration = conf.duration
        d1 = createDecoder(conf)
        d1.configure(conf)
      },
      onChunk (chunk: EncodedVideoChunk) {
        if (d1 === null) return
        console.log(1111, 'chunk')
        d1.decode(chunk)
        // console.log('---- chunk', chunk)
      },
      setStatus (a: string, b: string) {
        console.log(1111, 'done', a, b)
        if (b !== 'Done') return
        // 排队等待 第一个视频结束编码
        v1Ready.then(() => {
          let d2: VideoDecoder | null = null
          // eslint-disable-next-line
          new MP4Demuxer(fileRS2, {
            onConfig (conf: VideoDecoderConfig) {
              console.log(2222, 'config', conf, v1Duration)
              d2 = createDecoder(conf, v1Duration * 1000)
              d2.configure(conf)
              // decoder.configure(conf)
            },
            onChunk (chunk: EncodedVideoChunk) {
              if (d2 === null) return
              console.log(2222, 'chunk')
              d2.decode(chunk)
              // console.log('---- chunk', chunk)
            },
            setStatus (a: string, b: string) {
              console.log(2222, 'setStatus', a, b)
            }
          })
        }).catch(console.error)
      }
    })
  }
}

function createDecoder (conf: VideoDecoderConfig, tsOffset = 0): VideoDecoder {
  let ready = (): void => {}
  let timerId = 0
  v1Ready = new Promise<void>((resolve) => {
    ready = resolve
  })
  const decoder = new VideoDecoder({
    output (frame) {
      // // @ts-expect-error
      // ctx?.drawImage(frame, 0, 0, 1280, 720)
      const ts = frame.timestamp
      // console.log(44444444, ts, tsOffset)

      // @ts-expect-error
      // const newFr = new VideoFrame(cvs, {
      const newFr = new VideoFrame(frame, {
        timestamp: ts + tsOffset,
        duration: frame.duration,
        alpha: 'discard'
      })
      encoder.encode(newFr)

      frame.close()
      newFr.close()
      clearTimeout(timerId)
      timerId = self.setTimeout(ready, 200)
    },
    error (e) {
      console.error(e)
    }
  })

  decoder.configure(conf)

  return decoder
}

let endTimer = 0
const videoEncodingTrackOptions = {
  // 微秒
  timescale: 1e6,
  width: 1280,
  height: 720,
  brands: ['isom', 'iso2', 'avc1', 'mp41'],
  // brands: ['avc1'],
  avcDecoderConfigRecord: null as AllowSharedBufferSource | undefined | null
}
let vTrackId: number | null = null
const outputFile = mp4box.createFile()
const encoder = new VideoEncoder({
  output (chunk, meta) {
    // console.log('======///', chunk, meta)
    if (vTrackId == null) {
      videoEncodingTrackOptions.avcDecoderConfigRecord = meta.decoderConfig?.description
      vTrackId = outputFile.addTrack(videoEncodingTrackOptions)
    }
    const buf = new ArrayBuffer(chunk.byteLength)
    chunk.copyTo(buf)

    // console.log(4444555, chunk.duration, chunk, meta)
    outputFile.addSample(
      vTrackId,
      buf,
      {
        // 每帧时长，单位微秒
        duration: chunk.duration ?? 0,
        // dts,
        // cts,
        is_sync: chunk.type === 'key'
      }
    )
    clearTimeout(endTimer)
    endTimer = self.setTimeout(() => {
      outputFile.flush()
      const stream = new mp4box.DataStream()
      stream.endianness = mp4box.DataStream.BIG_ENDIAN
      outputFile.write(stream)
      self.postMessage({
        type: 'mp4-buffer',
        data: stream.buffer
        // @ts-expect-error
      }, [stream.buffer])
    }, 1000)
  },
  error: console.error
})
encoder.configure({
  codec: 'avc1.42E01F',
  width: 1280,
  height: 720,
  framerate: 30,
  hardwareAcceleration: 'prefer-hardware',
  // 码率
  // bitrate: 3_000_000,
  // mac 自带播放器只支持avc
  avc: { format: 'avc' },
  alpha: 'discard'
})
