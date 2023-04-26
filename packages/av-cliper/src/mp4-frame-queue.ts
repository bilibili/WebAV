import mp4box, { MP4ArrayBuffer, MP4Sample, MP4VideoTrack } from 'mp4box'
import { parseVideoCodecDesc, sleep } from './utils'

export class MP4FrameQueue {
  #videoFrame: VideoFrame[] = []

  #ts = 0

  ready: Promise<void>

  #videoInfo: { duration: number } = { duration: Infinity }

  #frameParseEnded = false

  constructor (rs: ReadableStream<Uint8Array>) {
    this.ready = new Promise((resolve) => {
      let lastVf: VideoFrame | null = null
      const { ready, seek } = parseMP42Frames(rs, (vf) => {
        this.#videoFrame.push(vf)
        lastVf = vf
        resolve()
      }, () => {
        if (lastVf == null) throw Error('mp4 parse error, no video frame')
        this.#videoInfo.duration = lastVf.timestamp + (lastVf.duration ?? 0)
        this.#frameParseEnded = true
      })
      ready.then(() => {
        seek(0)
        // this.#videoInfo = getInfo()
      }).catch(console.error)
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

    this.#ts = time
    const { frame, nextOffset } = this.#next(time)
    if (frame == null) {
      if (nextOffset === -1) {
        // 解析已完成，队列已清空
        if (this.#frameParseEnded) {
          return {
            frame: null,
            state: 'done'
          }
        }
        // 队列已空，等待补充 vf
        await sleep(5)
        return await this.forward(time)
      }
      // 当前 time 小于最前的 frame.timestamp，等待 time 增加
      return {
        frame: null,
        state: 'next'
      }
    }

    if (time >= nextOffset) {
      // frame 过期，再取下一个
      frame?.close()
      return await this.forward(time)
    }
    return {
      frame,
      state: 'success'
    }
  }
}

export function parseMP42Frames (
  rs: ReadableStream<Uint8Array>,
  onOutput: (vf: VideoFrame) => void,
  onEnded: () => void
): {
    ready: Promise<void>
    getInfo: () => { duration: number }
    seek: (time: number) => void
  } {
  const mp4File = mp4box.createFile()
  const vd = new VideoDecoder({
    output: (vf) => {
      onOutput(vf)
      resetTimer()
    },
    error: console.error
  })
  let endedTimer = 0
  function resetTimer (): void {
    clearTimeout(endedTimer)
    endedTimer = self.setTimeout(() => {
      if (vd.decodeQueueSize === 0) {
        onEnded()
      }
      // todo: warn, mabye not close emited frame
    }, 300)
  }

  let vInfo: MP4VideoTrack | null = null
  mp4File.onReady = (info) => {
    const vTrackInfo = info.videoTracks[0]
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
