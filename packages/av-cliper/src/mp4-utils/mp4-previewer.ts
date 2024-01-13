import { MP4Info } from '@webav/mp4box.js'
import { autoReadStream } from '../av-utils'
import { Log } from '../log'
import { extractFileConfig } from './mp4box-utils'
import { SampleTransform } from './sample-transform'

export class MP4Previewer {
  #ready: Promise<MP4Info>

  constructor(stream: ReadableStream<Uint8Array>) {
    this.#ready = this.#init(stream)
  }

  async #init(stream: ReadableStream<Uint8Array>) {
    const opfsRoot = await navigator.storage.getDirectory()
    const fileHandle = await opfsRoot.getFileHandle(Math.random().toString(), {
      create: true
    })
    const fileWriter = await fileHandle.createWritable()
    const videoDecoder = new VideoDecoder({
      output: () => { },
      error: Log.error
    })

    const trackIndex = []
    let offset = 0
    return new Promise<MP4Info>((resolve, reject) => {
      let mp4Info: MP4Info | null = null
      autoReadStream(stream.pipeThrough(new SampleTransform()), {
        onChunk: async ({ chunkType, data }): Promise<void> => {
          if (chunkType === 'ready') {
            const { videoDecoderConf } = extractFileConfig(data.file, data.info)
            if (videoDecoderConf == null) {
              reject('Unsupported codec')
              return
            }
            mp4Info = data.info
            videoDecoder.configure(videoDecoderConf)
          }
          if (chunkType === 'samples' && data.type === 'video') {
            for (const s of data.samples) {
              trackIndex.push({
                offset,
                size: s.data.byteLength,
                cts: s.cts,
                duration: s.duration
              })
              offset += s.data.byteLength
              await fileWriter.write(s.data)
            }
          }
        },
        onDone: async () => {
          await fileWriter.close()
          console.log(4444, await fileHandle.getFile())
          if (mp4Info == null) {
            reject('Parse failed')
            return
          }
          resolve(mp4Info)
        }
      })
    })
  }

  async getInfo() {
    return await this.#ready
  }

  getVideoFrame(time: number): VideoFrame {
    throw Error('Not implemented')
  }
}
