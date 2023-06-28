import JsWebm from 'jswebm'
import OGVDemuxerWebMW from 'ogv/dist/ogv-demuxer-webm-wasm'
import { autoReadStream } from '../av-utils'

import { IClip } from './iclip'

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
    const webm = new JsWebm()

    this.ready = new Promise(async resolve => {
      const demuxer = await OGVDemuxerWebMW()
      demuxer.onseek = offset => {
        console.log('--- onseek', offset)
      }
      demuxer.init(() => {})

      demuxer.ready.then(() => {
        console.log(77777777777, demuxer.audioReady)
        console.log(4444, demuxer)
      })

      autoReadStream(rs, {
        onDone () {
          console.log(9999)
          setInterval(() => {
            console.log(444)
            demuxer.process(() => {})
            // demuxer.dequeueVideoPacket(packet => {
            //   console.log('-- webm packet', packet)
            // })
          }, 100)

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

          // webm.queueData(buf.buffer)
          // webm.demux()
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
