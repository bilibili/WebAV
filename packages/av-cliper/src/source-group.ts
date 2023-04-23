import mp4box, { MP4File } from 'mp4box'
import { MP4Source } from './mp4-source'

enum EState {
  Pending = 'pending',
  Reading = 'reading',
  Done = 'done'
}

interface IItem {
  source: MP4Source
  reader: ReadableStreamDefaultReader<VideoFrame | AudioData>
  startDemux: () => void
  description_index: number
  state: EState
}

export class SourceGroup {
  #staticItems: IItem[] = []

  #ts = 0

  #offsetTs = 0

  #state = 'pending'

  #outFile = mp4box.createFile()

  #outputCanceled = false

  #stopOutput: () => void

  outputStream: ReadableStream<ArrayBuffer>
  #videoEncoder: VideoEncoder

  constructor () {
    let updateCnt = 0
    this.#videoEncoder = createVideoEncoder(this.#outFile, () => {
      updateCnt += 1
    })

    const { stream, stop: stopOutput } = convertFile2Stream(this.#outFile, 500, () => {
      this.#outputCanceled = true
      stopOutput()
    })

    // this.#outFile.start()

    this.#stopOutput = () => {
      let last = updateCnt
      const timerId = self.setInterval(() => {
        console.log(3333, { last, updateCnt })
        if (last === updateCnt) {
          clearInterval(timerId)
          stopOutput()
        }
        last = updateCnt
      }, 300)
    }
    this.outputStream = stream
  }

  async add (source: MP4Source): Promise<void> {
    this.#staticItems.push({
      source,
      reader: source.stream.getReader(),
      startDemux: source.startDemux,
      description_index: this.#staticItems.length + 1,
      state: EState.Pending
    })
  }

  start (): void {
    if (this.#state !== 'running') {
      this.#state = 'running'
      this.#run().catch(console.error)
    }
  }

  async #run (): Promise<void> {
    const it = this.#findNext()
    console.log('--- findnext: ', it)
    if (it == null || this.#outputCanceled) {
      this.#stopOutput()
      return
    }
    if (it.state !== EState.Reading) {
      it.state = EState.Reading
      it.startDemux()
    }

    const { done, value } = await it.reader.read()
    if (done) {
      it.state = EState.Done
      this.#offsetTs = this.#ts
      console.log(222222, this.#offsetTs)
      this.#run().catch(console.error)
      return
    }

    if (value instanceof VideoFrame) {
      const newf = new VideoFrame(value, {
        timestamp: value.timestamp + this.#offsetTs,
        alpha: 'discard'
      })
      this.#ts = value.timestamp

      this.#videoEncoder.encode(newf)
      newf.close()
      value.close()

      this.#run().catch(console.error)
    } else if (value instanceof AudioData) {
      value.close()
      this.#run().catch(console.error)
    }
  }

  // todo: 应该返回 IItem
  #findNext (): IItem | null {
    const items = this.#staticItems.filter(it => it.state !== EState.Done)
    const next = items[0]

    return next ?? null
  }
}

function convertFile2Stream (
  file: MP4File,
  timeSlice: number,
  onCancel: () => void
): {
    stream: ReadableStream<ArrayBuffer>
    stop: () => void
  } {
  let timerId = 0

  let sendedBoxIdx = 0
  const boxes = file.boxes
  const deltaBuf = (): ArrayBuffer | null => {
    if (sendedBoxIdx >= boxes.length) return null
    const ds = new mp4box.DataStream()
    ds.endianness = mp4box.DataStream.BIG_ENDIAN
    for (let i = sendedBoxIdx; i < boxes.length; i++) {
      boxes[i].write(ds)
    }
    sendedBoxIdx = boxes.length
    return ds.buffer
  }

  let stoped = false
  let exit: (() => void) | null = null
  const stream = new ReadableStream({
    start (ctrl) {
      timerId = self.setInterval(() => {
        const buf = deltaBuf()
        if (buf != null) ctrl.enqueue(buf)
      }, timeSlice)

      exit = () => {
        clearInterval(timerId)
        file.flush()
        const buf = deltaBuf()
        if (buf != null) ctrl.enqueue(buf)
        ctrl.close()
      }

      // 安全起见，检测如果start触发时已经 stoped
      if (stoped) exit()
    },
    cancel () {
      clearInterval(timerId)
      onCancel()
    }
  })

  return {
    stream,
    stop: () => {
      stoped = true
      exit?.()
    }
  }
}

function createVideoEncoder (outputFile: MP4File, onUpdate: () => void): VideoEncoder {
  const vTrackOpts = {
  // 微秒
    timescale: 1e6,
    width: 1280,
    height: 720,
    brands: ['isom', 'iso2', 'avc1', 'mp41'],
    avcDecoderConfigRecord: null as AllowSharedBufferSource | undefined | null
  }
  let vTrackId = 0
  const encoder = new VideoEncoder({
    output (chunk, meta) {
      onUpdate()
      if (vTrackId === 0 && meta != null) {
        vTrackOpts.avcDecoderConfigRecord = meta.decoderConfig?.description
        vTrackId = outputFile.addTrack(vTrackOpts)
      }
      const buf = new ArrayBuffer(chunk.byteLength)
      chunk.copyTo(buf)

      const dts = chunk.timestamp
      outputFile.addSample(
        vTrackId,
        buf,
        {
        // 每帧时长，单位微秒
          duration: chunk.duration ?? 0,
          dts,
          cts: dts,
          is_sync: chunk.type === 'key'
        }
      )
    },
    error: console.error
  })
  encoder.configure({
    codec: 'avc1.42E01F',
    width: 1280,
    height: 720,
    framerate: 30,
    hardwareAcceleration: 'prefer-hardware',
    // 码率
    // bitrate: 3_000_000,
    // mac 自带播放器只支持avc
    avc: { format: 'avc' },
    alpha: 'discard'
  })
  return encoder
}
