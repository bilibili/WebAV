import { MP4Info, MP4File, MP4Sample } from "@webav/mp4box.js"
import { autoReadStream } from "../av-utils"
import { SampleTransform } from "./sample-transform"

export class MP4Previewer {
  constructor(stream: ReadableStream<Uint8Array>) {
    autoReadStream(stream.pipeThrough(new SampleTransform()), {
      onChunk: function (chunk: { chunkType: "ready"; data: { info: MP4Info; file: MP4File } } | { chunkType: "samples"; data: { id: number; type: "video" | "audio"; samples: MP4Sample[] } }): Promise<void> {
        throw new Error("Function not implemented.")
      },
      onDone: function (): void {
        throw new Error("Function not implemented.")
      }
    })
  }

  getVideoFrame(time: number): VideoFrame {
    throw Error('Not implemented')
  }
}
