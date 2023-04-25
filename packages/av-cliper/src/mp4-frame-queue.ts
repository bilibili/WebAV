import mp4box, { MP4ArrayBuffer, MP4Sample, MP4VideoTrack } from 'mp4box'
import { parseVideoCodecDesc, sleep } from './utils'

export class MP4FrameQueue {
  #videoFrame: VideoFrame[] = []

  #ts = 0

  ready: Promise<void>

  #videoInfo: { duration: number } = { duration: 0 }

  constructor (rs: ReadableStream<Uint8Array>) {
    this.ready = new Promise((resolve) => {
      let cnt = 0
      const { ready, seek, getInfo } = parseMP42Frames(rs, (vf) => {
        this.#videoFrame.push(vf)
        cnt++
        resolve()
      })
      ready.then(() => {
        seek(0)
        this.#videoInfo = getInfo()
      }).catch(console.error)

      setTimeout(() => {
        console.log(88888, this.#videoInfo, cnt)
      }, 5000)
    })
  }

  #next (time: number): { frame: VideoFrame | null, nextOffset: number } {
    const rs = this.#videoFrame[0] ?? null
    if (rs == null) {
      return {
        frame: null,
        nextOffset: -1
      }
    }

    if (time < rs.timestamp) {
      return {
        frame: null,
        nextOffset: rs.timestamp
      }
    }

    this.#videoFrame.shift()
    return {
      frame: rs,
      nextOffset: this.#videoFrame[0]?.timestamp ?? -1
    }
  }

  async forward (time: number): Promise<{
    frame: VideoFrame | null
    state: 'success' | 'next' | 'done'
  }> {
    if (time < this.#ts) throw Error('time not allow rollback')
    if (time >= this.#videoInfo.duration) {
      return {
        frame: null,
        state: 'done'
      }
    }
    while (true) {
      const { frame, nextOffset } = this.#next(time)
      this.#ts = time
      if (frame == null && nextOffset === -1) {
        // console.log(22222222222)
        // 等待填充 vf
        await sleep(5)
        continue
      }

      if (frame == null && nextOffset > time) {
        // 需要外部增加时间
        // todo: 维持最后一帧
        return {
          frame: null,
          state: 'next'
        }
      }

      if (time >= nextOffset) {
        // frame 过期，再取下一个
        frame?.close()
        continue
      }

      return {
        frame,
        state: 'success'
      }
    }
  }
}

export function parseMP42Frames (
  rs: ReadableStream<Uint8Array>,
  onOutput: (vf: VideoFrame) => void
): {
    ready: Promise<void>
    getInfo: () => { duration: number }
    seek: (time: number) => void
  } {
  const mp4File = mp4box.createFile()
  const vd = new VideoDecoder({
    output: onOutput,
    error: console.error
  })

  let vInfo: MP4VideoTrack | null = null
  mp4File.onReady = (info) => {
    const vTrackInfo = info.videoTracks[0]
    console.log(44444, info, vTrackInfo)
    if (vTrackInfo != null) {
      vInfo = vTrackInfo
      const vTrack = mp4File.getTrackById(vTrackInfo.id)
      // Generate and emit an appropriate VideoDecoderConfig.
      const vdConf = {
        codec: vTrackInfo.codec,
        codedHeight: vTrackInfo.video.height,
        codedWidth: vTrackInfo.video.width,
        description: parseVideoCodecDesc(vTrack)
        // duration: info.duration
      }
      vd.configure(vdConf)
      mp4File.setExtractionOptions(vTrackInfo.id, 'video')
      mp4File.start()
    }
  }

  let videoSamples: MP4Sample[] = []
  let duration = 0
  const ready = new Promise<void>((resolve) => {
    let timerId = 0
    mp4File.onSamples = (_, __, samples) => {
      videoSamples = videoSamples.concat(samples)
      clearTimeout(timerId)
      timerId = self.setTimeout(() => {
        // 单位  微秒
        duration = videoSamples.reduce((acc, cur) => acc + cur.duration, 0) /
          (vInfo?.timescale ?? 1e6) *
          1e6
        resolve()
      }, 300)
    }
  })

  const reader = rs.getReader()
  let chunkOffset = 0
  async function readFile (): Promise<void> {
    const { done, value } = await reader.read()
    if (done) {
      console.log('source read done')
      return
    }

    const chunk = value.buffer as MP4ArrayBuffer
    chunk.fileStart = chunkOffset
    chunkOffset += chunk.byteLength
    mp4File.appendBuffer(chunk)

    readFile().catch(console.error)
  }
  readFile().catch(console.error)

  return {
    ready,
    getInfo: () => ({
      duration
    }),
    seek: (time) => {
      // console.log(1111, videoSamples, vInfo)
      if (vInfo == null) throw Error('Not ready')

      const targetTime = time * vInfo.timescale
      const endIdx = videoSamples.findIndex(s => s.cts >= targetTime)
      const targetSamp = videoSamples[endIdx]

      if (targetSamp == null) throw Error('Not found frame')
      let startIdx = 0
      if (!targetSamp.is_sync) {
        startIdx = endIdx - 1
        while (true) {
          if (startIdx <= 0) break
          if (videoSamples[startIdx].is_sync) break
          startIdx -= 1
        }
      }
      // samples 全部 推入解码器，解码器有维护队列
      const samples = videoSamples.slice(startIdx)
      samples.forEach(s => {
      // videoSamples.forEach(s => {
        vd.decode(new EncodedVideoChunk({
          type: s.is_sync ? 'key' : 'delta',
          timestamp: 1e6 * s.cts / s.timescale,
          duration: 1e6 * s.duration / s.timescale,
          data: s.data
        }))
      })
    }
  }
}
