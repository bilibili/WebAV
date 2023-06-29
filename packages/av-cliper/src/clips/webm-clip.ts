import OGVDemuxerWebMW from 'ogv/dist/ogv-demuxer-webm-wasm'
import OGVDecoderVideoVP9W from 'ogv/dist/ogv-decoder-video-vp9-wasm'
import { autoReadStream } from '../av-utils'

import { IClip } from './iclip'
import { Log } from '../log'

export class WebMClip implements IClip {
  ready: IClip['ready']

  constructor (
    rs: ReadableStream<Uint8Array>,
    opts: {
      audio?: boolean | { volume: number }
      start?: number
      end?: number
    } = {}
  ) {
    this.ready = new Promise(async resolve => {
      const demuxer = await OGVDemuxerWebMW()
      const decoder = await OGVDecoderVideoVP9W()
      demuxer.init(() => {})
      decoder.init(() => {})

      demuxer.ready.then(() => {
        console.log(4444, demuxer, decoder)
      })

      function process (rs: boolean) {
        if (rs) demuxer.process(process)
        else decode()
      }

      function decode () {
        // const decoder = new VideoDecoder({
        //   error: Log.error,
        //   output: vf => {
        //     console.log(1111111, vf, decoder.decodeQueueSize)
        //     const buf = new ArrayBuffer(vf.allocationSize())
        //     vf.copyTo(buf).then(d => console.log(6666, buf))
        //     ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height)
        //     ctx.drawImage(vf, 0, 0)
        //     // vf.close()
        //   }
        // })
        // decoder.configure({
        //   codec: 'vp09.00.20.08',
        //   codedHeight: demuxer.videoFormat.height,
        //   codedWidth: demuxer.videoFormat.width
        // })
        console.log(5555, demuxer.videoPackets)
        demuxer.videoPackets.forEach((p, idx) => {
          if (idx === 0) {
            decoder.processHeader(p, ok => {
              console.log(6666, ok)
            })
          } else {
            decoder.processFrame(p, ok => {
              // hack
              let fb = decoder.frameBuffer
              console.log(6666, fb, ok)
            })
          }
        })
        // for (const p of demuxer.videoPackets) {
        // decoder.decode(
        //   new EncodedVideoChunk({
        //     type: (p.isKeyframe ? 'key' : 'delta') as EncodedVideoChunkType,
        //     timestamp: 1e6 * p.timestamp,
        //     data: p.data
        //   })
        // )
        // }
      }

      autoReadStream(rs, {
        onDone () {
          let i = 0
          demuxer.process(process)
          // setInterval(() => {
          //   demuxer.dequeueVideoPacket(packet => {
          //     if (packet != null) i++
          //     console.log('-- webm packet', packet, i)
          //   })
          // }, 10)

          // demuxer.flush(() => {})
          // demuxer.dequeueVideoPacket(packet => {
          //   console.log('-- webm packet', packet)
          // })
          // demuxer.run()
          resolve({
            width: 0,
            height: 0,
            duration: 0
          })
        },
        async onChunk (buf) {
          demuxer.receiveInput(buf.buffer, () => {})
        }
      })
    })
  }

  async tick (time: number): Promise<{
    video?: VideoFrame | ImageBitmap | undefined
    audio?: Float32Array[] | undefined
    state: 'done' | 'success'
  }> {
    return {
      state: 'done'
    }
  }

  destroy () {}
}
