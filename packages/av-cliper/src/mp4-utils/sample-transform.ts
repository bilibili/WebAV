import mp4box, { MP4ArrayBuffer, MP4File, MP4Info, MP4Sample } from "@webav/mp4box.js";
import { sleep } from "../av-utils";

/**
 * 将原始字节流转换成 MP4Sample 流
 */
export class SampleTransform {
  readable: ReadableStream<
    | {
      chunkType: 'ready'
      data: { info: MP4Info; file: MP4File }
    }
    | {
      chunkType: 'samples'
      data: { id: number; type: 'video' | 'audio'; samples: MP4Sample[] }
    }
  >

  writable: WritableStream<Uint8Array>

  #inputBufOffset = 0

  constructor() {
    const file = mp4box.createFile()
    let outCtrlDesiredSize = 0
    let streamCancelled = false
    this.readable = new ReadableStream(
      {
        start: ctrl => {
          file.onReady = info => {
            const vTrackId = info.videoTracks[0]?.id
            if (vTrackId != null)
              file.setExtractionOptions(vTrackId, 'video', { nbSamples: 100 })

            const aTrackId = info.audioTracks[0]?.id
            if (aTrackId != null)
              file.setExtractionOptions(aTrackId, 'audio', { nbSamples: 100 })

            ctrl.enqueue({ chunkType: 'ready', data: { info, file } })
            file.start()
          }

          file.onSamples = (id, type, samples) => {
            ctrl.enqueue({
              chunkType: 'samples',
              data: { id, type, samples }
            })
            outCtrlDesiredSize = ctrl.desiredSize ?? 0
          }

          file.onFlush = () => {
            ctrl.close()
          }
        },
        pull: ctrl => {
          outCtrlDesiredSize = ctrl.desiredSize ?? 0
        },
        cancel: () => {
          file.stop()
          streamCancelled = true
        }
      },
      {
        // 每条消息 100 个 samples
        highWaterMark: 50
      }
    )

    this.writable = new WritableStream({
      write: async ui8Arr => {
        if (streamCancelled) {
          this.writable.abort()
          return
        }

        const inputBuf = ui8Arr.buffer as MP4ArrayBuffer
        inputBuf.fileStart = this.#inputBufOffset
        this.#inputBufOffset += inputBuf.byteLength
        file.appendBuffer(inputBuf)

        // 等待输出的数据被消费
        while (outCtrlDesiredSize < 0) await sleep(50)
      },
      close: () => {
        file.flush()
        file.stop()
        file.onFlush?.()
      }
    })
  }
}