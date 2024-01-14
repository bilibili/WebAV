import { MP4File, MP4Info, MP4Sample } from '@webav/mp4box.js'
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

  #wrapDecoder: ReturnType<typeof wrapVideoDecoder> | null = null

  #cvs: OffscreenCanvas | null = null

  constructor(stream: ReadableStream<Uint8Array>) {
    this.#ready = this.#init(stream)
  }

  async #init(stream: ReadableStream<Uint8Array>) {
    let offset = 0
    return new Promise<MP4Info>((resolve, reject) => {
      let mp4Info: MP4Info | null = null
      let mp4boxFile: MP4File | null = null
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
            mp4boxFile = data.file

            this.#wrapDecoder = wrapVideoDecoder(videoDecoderConf)
          }
          if (chunkType === 'samples') {
            if (data.type === 'video') {
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
            }
            mp4boxFile?.releaseUsedSamples(data.id, data.samples.length)
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

  async getInfo() {
    return await this.#ready
  }

  // time 单位秒 s
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
    return new Promise<VideoFrame>((resolve) => {
      this.#wrapDecoder?.decode(chunks, (vf, done) => {
        if (done) resolve(vf)
        else vf.close()
      })
    })
  }
}

function wrapVideoDecoder(conf: VideoDecoderConfig) {
  type OutputHandle = (vf: VideoFrame, done: boolean) => void

  let curCb: ((vf: VideoFrame) => void) | null = null
  const vdec = new VideoDecoder({
    output: (vf) => {
      curCb?.(vf)
    },
    error: Log.error
  })
  vdec.configure(conf)

  let tasks: Array<{
    chunks: EncodedVideoChunk[]
    cb: (vf: VideoFrame, done: boolean) => void
  }> = []

  async function run() {
    if (curCb != null) return

    const t = tasks.shift()
    if (t == null) return
    let i = 0
    curCb = (vf) => {
      i += 1
      const done = i >= t.chunks.length
      t.cb(vf, done)
      if (done) {
        curCb = null
        run().catch(Log.error)
      }
    }
    for (const chunk of t.chunks) vdec.decode(chunk)
    await vdec.flush()
  }

  return {
    decode(chunks: EncodedVideoChunk[], cb: OutputHandle) {
      tasks.push({ chunks, cb })
      run().catch(Log.error)
    }
  }
}