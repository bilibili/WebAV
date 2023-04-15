import MuxMP4Worker from './mux-mp4-worker?worker&inline'
import { EWorkerMsg, IRecorderConf, IStream } from './types'

type TState = 'inactive' | 'recording' | 'paused'
export class AVRecorder {
  #state: TState = 'inactive'
  get state (): 'inactive' | 'recording' | 'paused' { return this.#state }
  set state (_: TState) { throw new Error('state is readonly') }

  #ms

  #conf: Required<IRecorderConf>

  #worker: Worker | null = null

  outputStream: ReadableStream<Uint8Array> | null = null

  constructor (inputMediaStream: MediaStream, conf: IRecorderConf = {}) {
    this.#ms = inputMediaStream
    this.#conf = {
      width: 1280,
      height: 720,
      bitrate: 1_500_000,
      fps: 30,
      audioCodec: conf.audioCodec ?? 'opus',
      ...conf
    }
  }

  async start (timeSlice: number = 500): Promise<void> {
    const worker = new MuxMP4Worker()
    this.#worker = worker

    const streams: IStream = {}
    const videoTrack = this.#ms.getVideoTracks()[0]
    if (videoTrack != null) {
      streams.video = new MediaStreamTrackProcessor({
        track: videoTrack
      }).readable
    }

    const audioTrack = this.#ms.getAudioTracks()[0]
    if (audioTrack != null) {
      streams.audio = new MediaStreamTrackProcessor({
        track: audioTrack
      }).readable
    }

    if (streams.audio == null && streams.video == null) {
      throw new Error('No available tracks in MediaStream')
    }

    worker.postMessage({
      type: EWorkerMsg.Start,
      data: {
        ...this.#conf,
        timeSlice,
        streams
      }
    }, Object.values(streams))

    return await new Promise<void>((resolve) => {
      worker.addEventListener('message', (evt: MessageEvent) => {
        const { type, data } = evt.data
        switch (type) {
          case EWorkerMsg.OutputStream:
            this.#state = 'recording'
            this.outputStream = data
            resolve()
            break
        }
      })
    })
  }

  async stop (): Promise<void> {
    this.#state = 'inactive'
    const worker = this.#worker
    if (worker == null) return

    worker.postMessage({ type: EWorkerMsg.Stop })
    return await new Promise<void>((resolve) => {
      worker.addEventListener('message', (evt: MessageEvent) => {
        const { type } = evt.data
        switch (type) {
          case EWorkerMsg.SafeExit:
            worker.terminate()
            resolve()
            break
        }
      })
    })
  }
}
