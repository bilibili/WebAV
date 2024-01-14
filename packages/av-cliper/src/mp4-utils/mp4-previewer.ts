import { MP4Info, MP4Sample } from '@webav/mp4box.js'
import { autoReadStream } from '../av-utils'
import { Log } from '../log'
import { extractFileConfig, sample2ChunkOpts } from './mp4box-utils'
import { OPFSFileWrap } from './opfs-file-wrap'
import { SampleTransform } from './sample-transform'

export class MP4Previewer {
  #ready: Promise<MP4Info>

  #videoSamples: Array<Omit<MP4Sample, 'data'> & {
    offset: number
    timeEnd: number
    data: null
  }> = []

  #opfsFile = new OPFSFileWrap(Math.random().toString())

  constructor(stream: ReadableStream<Uint8Array>) {
    this.#ready = this.#init(stream)
  }

  async #init(stream: ReadableStream<Uint8Array>) {
    const videoDecoder = new VideoDecoder({
      output: () => { },
      error: Log.error
    })

    let offset = 0
    return new Promise<MP4Info>((resolve, reject) => {
      let mp4Info: MP4Info | null = null
      autoReadStream(stream.pipeThrough(new SampleTransform()), {
        onChunk: async ({ chunkType, data }): Promise<void> => {
          if (chunkType === 'ready') {
            const { videoDecoderConf, videoTrackConf } = extractFileConfig(data.file, data.info)
            if (videoDecoderConf == null || videoTrackConf == null) {
              reject('Unsupported codec')
              return
            }
            mp4Info = {
              ...data.info,
              duration: videoTrackConf.duration ?? 0,
              timescale: videoTrackConf.timescale
            }
            videoDecoder.configure(videoDecoderConf)
          }
          if (chunkType === 'samples' && data.type === 'video') {
            for (const s of data.samples) {
              this.#videoSamples.push({
                ...s,
                offset,
                timeEnd: s.cts + s.duration,
                data: null
              })
              offset += s.data.byteLength
              await this.#opfsFile.write(s.data)
            }
            // todo: 释放内存
          }
        },
        onDone: async () => {
          if (mp4Info == null) {
            reject('Parse failed')
            return
          }
          resolve(mp4Info)
        }
      })
    })
  }

  #decodeVideoChunk(chunks: EncodedVideoChunk[]) {

  }

  async getInfo() {
    return await this.#ready
  }

  async getVideoFrame(time: number): Promise<VideoFrame | null> {
    if (time < 0) return null
    const info = await this.#ready
    if (time > info.duration / info.timescale) return null

    let timeMapping = time * info.timescale
    const chunks: EncodedVideoChunk[] = []
    // todo: 二分查找
    for (let i = 0; i < this.#videoSamples.length; i += 1) {
      const si = this.#videoSamples[i]
      if (si.cts <= timeMapping && si.timeEnd >= timeMapping) {
        // 寻找最近的一个 关键帧
        if (!si.is_sync) {
          for (let j = i - 1; j >= 0; j -= 1) {
            const sj = this.#videoSamples[j]
            if (sj.is_sync) {
              chunks.push(new EncodedVideoChunk(sample2ChunkOpts({
                ...sj,
                data: await this.#opfsFile.read(sj.offset, sj.size)
              })))
              break
            }
          }
        }
        chunks.push(new EncodedVideoChunk(sample2ChunkOpts({
          ...si,
          data: await this.#opfsFile.read(si.offset, si.size)
        })))
        break
      }
    }
    console.log(55555, chunks)
  }
}

