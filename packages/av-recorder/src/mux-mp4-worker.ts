import mp4box from '@webav/mp4box.js'
import { autoReadStream, file2stream, recodemux } from '@webav/av-cliper'
import { TClearFn, EWorkerMsg, IWorkerOpts } from './types'

if (import.meta.env.DEV) {
  mp4box.Log.setLogLevel(mp4box.Log.debug)
}

enum State {
  Preparing = 'preparing',
  Running = 'running',
  Stopped = 'stopped'
}

class RecoderPauseCtrl {
  // 当前帧的偏移时间，用于计算帧的 timestamp
  #offsetTime = performance.now()

  // 编码上一帧的时间，用于计算出当前帧的持续时长
  #lastTime = this.#offsetTime

  // 用于限制 帧率
  #frameCnt = 0

  // 如果为true，则暂停编码数据
  // 取消暂停时，需要减去
  #paused = false

  // 触发暂停的时间，用于计算暂停持续了多久
  #pauseTime = 0

  constructor(readonly expectFPS: number) { }

  play() {
    if (!this.#paused) return
    this.#paused = false

    this.#offsetTime += performance.now() - this.#pauseTime
    this.#lastTime += performance.now() - this.#pauseTime
  }

  pause() {
    if (this.#paused) return
    this.#paused = true
    this.#pauseTime = performance.now()
  }

  transfrom(frame: VideoFrame) {
    const now = performance.now()
    const offsetTime = now - this.#offsetTime
    if (
      this.#paused ||
      // 避免帧率超出期望太高
      (this.#frameCnt / offsetTime) * 1000 > this.expectFPS
    ) {
      frame.close()
      return
    }

    const vf = new VideoFrame(frame, {
      // timestamp 单位 微秒
      timestamp: offsetTime * 1000,
      duration: (now - this.#lastTime) * 1000
    })
    this.#lastTime = now

    this.#frameCnt += 1
    frame.close()
    return {
      vf,
      opts: { keyFrame: this.#frameCnt % 30 === 0 }
    }
  }
}

const VIDEO_PAUSE_CTRL = new RecoderPauseCtrl(30)

let STATE = State.Preparing
// 当前是否处于暂停状态
let PAUSED = false

let clear: TClearFn | null = null
self.onmessage = async (evt: MessageEvent) => {
  const { type, data } = evt.data

  switch (type) {
    case EWorkerMsg.Start:
      if (STATE === State.Preparing) {
        STATE = State.Running
        clear = init(data, () => {
          STATE = State.Stopped
        })
      }
      break
    case EWorkerMsg.Stop:
      STATE = State.Stopped
      clear?.()
      self.postMessage({ type: EWorkerMsg.SafeExit })
      break
    case EWorkerMsg.Paused:
      PAUSED = data
      if (data) {
        VIDEO_PAUSE_CTRL.pause()
      } else {
        VIDEO_PAUSE_CTRL.play()
      }
  }
}

function init(opts: IWorkerOpts, onEnded: TClearFn): TClearFn {
  let stopEncodeVideo: TClearFn | null = null
  let stopEncodeAudio: TClearFn | null = null

  const recoder = recodemux({
    video: opts.video,
    audio: opts.audio,
    bitrate: opts.bitrate ?? 3_000_000
  })

  let stoped = false
  if (opts.streams.video != null) {
    let lastVf: VideoFrame | null = null
    let autoInsertVFTimer = 0
    const emitVf = (vf: VideoFrame) => {
      clearTimeout(autoInsertVFTimer)

      lastVf?.close()
      lastVf = vf
      const vfWrap = VIDEO_PAUSE_CTRL.transfrom(vf.clone())
      if (vfWrap == null) return
      recoder.encodeVideo(vfWrap.vf, vfWrap.opts)

      // 录制静态画面，MediaStream 不出帧时，每秒插入一帧
      autoInsertVFTimer = setTimeout(() => {
        if (lastVf == null) return
        const newVf = new VideoFrame(lastVf, {
          timestamp: lastVf.timestamp + 1e6,
          duration: 1e6
        })
        emitVf(newVf)
      }, 1000)
    }
    const stopReadStream = autoReadStream(opts.streams.video, {
      onChunk: async (chunk: VideoFrame) => {
        if (stoped) {
          chunk.close()
          return
        }
        emitVf(chunk)
      },
      onDone: () => { }
    })
    stopEncodeVideo = () => {
      stopReadStream()
      clearTimeout(autoInsertVFTimer)
      lastVf?.close()
    }
  }

  if (opts.audio != null && opts.streams.audio != null) {
    stopEncodeAudio = autoReadStream(opts.streams.audio, {
      onChunk: async (ad: AudioData) => {
        if (stoped || PAUSED) {
          ad.close()
          return
        }
        recoder.encodeAudio(ad)
      },
      onDone: () => { }
    })
  }

  const { stream, stop: stopStream } = file2stream(
    recoder.mp4file,
    opts.timeSlice,
    () => {
      exit()
      onEnded()
    }
  )
  self.postMessage(
    {
      type: EWorkerMsg.OutputStream,
      data: stream
    },
    // @ts-expect-error
    [stream]
  )

  function exit() {
    stoped = true

    stopEncodeVideo?.()
    stopEncodeAudio?.()
    recoder.close()
    stopStream()
  }

  return exit
}
