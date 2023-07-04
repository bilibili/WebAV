import {
  audioResample,
  concatFloat32Array,
  extractPCM4AudioData,
  sleep
} from '../av-utils'
import { Log } from '../log'
import { demuxcode } from '../mp4-utils'
import { DEFAULT_AUDIO_SAMPLE_RATE, IClip } from './iclip'

export class MP4Clip implements IClip {
  #videoFrames: VideoFrame[] = []

  #ts = 0

  ready: IClip['ready']

  #destroyed = false
  #decodeEnded = false

  #meta = {
    // 微秒
    duration: 0,
    width: 0,
    height: 0,
    audioSampleRate: DEFAULT_AUDIO_SAMPLE_RATE,
    audioChanCount: 2
  }

  #audioChan0 = new Float32Array(0)
  #audioChan1 = new Float32Array(0)

  #volume = 1

  #hasAudioTrack = false

  #demuxcoder: ReturnType<typeof demuxcode> | null = null

  constructor (
    rs: ReadableStream<Uint8Array>,
    opts: {
      audio?: boolean | { volume: number }
      start?: number
      end?: number
    } = {}
  ) {
    this.ready = new Promise(resolve => {
      let lastVf: VideoFrame | null = null
      this.#volume =
        typeof opts.audio === 'object' && 'volume' in opts.audio
          ? opts.audio.volume
          : 1
      this.#demuxcoder = demuxcode(
        rs,
        {
          audio: opts.audio !== false,
          start: (opts.start ?? 0) * 1e6,
          end: (opts.end ?? Infinity) * 1e6
        },
        {
          onReady: info => {
            this.#hasAudioTrack = info.audioTracks.length > 0
            const videoTrack = info.videoTracks[0]
            this.#meta = {
              duration: 0,
              width: videoTrack.track_width,
              height: videoTrack.track_height,
              audioSampleRate: DEFAULT_AUDIO_SAMPLE_RATE,
              audioChanCount: 2
            }
            Log.info('MP4Clip info:', info)
            resolve({
              width: videoTrack.track_width,
              height: videoTrack.track_height,
              duration:
                // fragment mp4 的duration 在 onComplete 回调中才知道
                videoTrack.duration === 0
                  ? -1
                  : (videoTrack.duration / videoTrack.timescale) * 1e6
            })
          },
          onVideoOutput: vf => {
            this.#videoFrames.push(vf)
            lastVf = vf
          },
          onAudioOutput: async ad => {
            this.#audioData2PCMBuf(ad)
          },
          onComplete: () => {
            this.#decodeEnded = true
            Log.info('MP4Clip decode complete')
            if (lastVf == null) throw Error('mp4 parse error, no video frame')
            this.#meta.duration = lastVf.timestamp + (lastVf.duration ?? 0)
          }
        }
      )
    })
  }

  #audioData2PCMBuf = (() => {
    let chan0 = new Float32Array(0)
    let chan1 = new Float32Array(0)

    let needResample = true
    const flushResampleData = async (curRate: number) => {
      const data = [chan0, chan1]
      chan0 = new Float32Array(0)
      chan1 = new Float32Array(0)

      const pcmArr = await audioResample(data, curRate, {
        rate: DEFAULT_AUDIO_SAMPLE_RATE,
        chanCount: 2
      })
      this.#audioChan0 = concatFloat32Array([this.#audioChan0, pcmArr[0]])
      this.#audioChan1 = concatFloat32Array([
        this.#audioChan1,
        pcmArr[1] ?? pcmArr[0]
      ])
    }
    // todo: 频繁合并PCM（内存释放分配），可能有性能优化空间
    return (ad: AudioData) => {
      needResample = ad.sampleRate !== DEFAULT_AUDIO_SAMPLE_RATE

      const pcmArr = extractPCM4AudioData(ad)
      let curRate = ad.sampleRate
      ad.close()
      if (this.#volume !== 1) {
        for (const pcm of pcmArr)
          for (let i = 0; i < pcm.length; i++) pcm[i] *= this.#volume
      }

      if (needResample) {
        chan0 = concatFloat32Array([chan0, pcmArr[0]])
        chan1 = concatFloat32Array([chan1, pcmArr[1] ?? pcmArr[0]])
        if (chan0.length >= curRate / 5) {
          // 累计 200ms 的音频数据再进行采样，过短可能导致声音有卡顿
          flushResampleData(curRate).catch(Log.error)
        }
      } else {
        this.#audioChan0 = concatFloat32Array([this.#audioChan0, pcmArr[0]])
        this.#audioChan1 = concatFloat32Array([
          this.#audioChan1,
          pcmArr[1] ?? pcmArr[0]
        ])
      }
    }
  })()

  async #nextVideo (time: number): Promise<VideoFrame | null> {
    if (this.#videoFrames.length === 0) {
      if (
        this.#destroyed ||
        (this.#decodeEnded &&
          this.#demuxcoder?.getDecodeQueueSize().video === 0)
      ) {
        return null
      }

      await sleep(50)
      return this.#nextVideo(time)
    }

    const rs = this.#videoFrames[0]
    if (time < rs.timestamp) {
      return null
    }
    if (time > rs.timestamp + (rs.duration ?? 0)) {
      // 过期，找下一帧
      this.#videoFrames.shift()?.close()
      return this.#nextVideo(time)
    }

    this.#videoFrames.shift()
    return rs
  }

  async #nextAudio (deltaTime: number): Promise<Float32Array[]> {
    const frameCnt = Math.ceil(deltaTime * (this.#meta.audioSampleRate / 1e6))
    if (frameCnt === 0) return []
    // 小心避免死循环
    if (
      this.#audioChan0.length < frameCnt &&
      !this.#destroyed &&
      this.#demuxcoder?.getDecodeQueueSize().audio !== 0
    ) {
      await sleep(50)
      return this.#nextAudio(deltaTime)
    }

    const audio = [
      this.#audioChan0.slice(0, frameCnt),
      this.#audioChan1.slice(0, frameCnt)
    ]

    this.#audioChan0 = this.#audioChan0.slice(frameCnt)
    if (this.#meta.audioChanCount > 1) {
      this.#audioChan1 = this.#audioChan1.slice(frameCnt)
    }
    return audio
  }

  // 默认直接返回
  tickInterceptor: NonNullable<IClip['tickInterceptor']> = async (_, tickRet) =>
    tickRet

  async tick (time: number): Promise<{
    video?: VideoFrame
    audio: Float32Array[]
    state: 'success' | 'done'
  }> {
    if (time < this.#ts) throw Error('time not allow rollback')
    if (this.#decodeEnded && time >= this.#meta.duration) {
      return await this.tickInterceptor<MP4Clip>(time, {
        audio: [],
        state: 'done'
      })
    }

    const audio = this.#hasAudioTrack
      ? await this.#nextAudio(time - this.#ts)
      : []
    const video = await this.#nextVideo(time)
    this.#ts = time
    if (video == null) {
      return await this.tickInterceptor<MP4Clip>(time, {
        audio,
        state: 'success'
      })
    }

    return await this.tickInterceptor<MP4Clip>(time, {
      video,
      audio,
      state: 'success'
    })
  }

  destroy (): void {
    Log.info(
      'MP4Clip destroy, ts:',
      this.#ts,
      ', remainder frame count:',
      this.#videoFrames.length,
      ', decoderQueueSzie:',
      this.#demuxcoder?.getDecodeQueueSize()
    )
    this.#destroyed = true
    this.#demuxcoder?.stop()
    this.#videoFrames.forEach(f => f.close())
    this.#videoFrames = []
  }
}
