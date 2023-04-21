import mp4box, { AVC1BoxParser, MP4ABoxParser, MP4File, MP4Sample, TrakBoxParser } from 'mp4box'
import { MP4Source } from './mp4-source'

enum EState {
  Pending = 'pending',
  Reading = 'reading',
  Done = 'done'
}

interface IItem {
  source: MP4Source
  tracks: TrakBoxParser[]
  reader: ReadableStreamDefaultReader<MP4Sample>
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

  #stopOutput = (): void => {}

  outputStream: ReadableStream<ArrayBuffer>

  constructor () {
    // this.outputStream = new ReadableStream({
    //   start: (ctrl) => {
    //     this.#ctrl = ctrl
    //   }
    // })
    const { stream, stop: stopOutput } = convertFile2Stream(this.#outFile, 500, () => {
      this.#outputCanceled = true
    })

    this.#stopOutput = stopOutput
    this.outputStream = stream
  }

  async add (source: MP4Source): Promise<void> {
    this.#staticItems.push({
      source,
      tracks: await source.getTracks(),
      reader: source.sampleStream.getReader(),
      description_index: this.#staticItems.length + 1,
      state: EState.Pending
    })
  }

  start (): void {
    const trakByType = this.#staticItems.map(({ tracks }) => tracks)
      .flat()
      .map(t => t.mdia.minf.stbl.stsd.entries)
      .flat()
      .reduce((acc, cur) => {
        // @ts-expect-error
        const arr = (acc[cur.type] ?? []).concat(cur)
        return { ...acc, [cur.type]: arr }
      }, {}) as { avc1?: AVC1BoxParser[], mp4a?: MP4ABoxParser[] }

    console.log(34444, trakByType)
    let vTrackId: null | number = null
    if (trakByType.avc1 != null) {
      const f = trakByType.avc1[0]
      vTrackId = this.#outFile.addTrack({
        timescale: 1e6,
        width: f.width,
        height: f.height,
        brands: ['isom', 'iso2', 'avc1', 'mp41'],
        description_boxes: trakByType.avc1.map(a => a.avcC)
      })
    }
    let aTrackId: null | number = null
    if (trakByType.mp4a != null) {
      const mp4aBox = trakByType.mp4a[0]
      // todo：音轨需要重编码，没想到怎么复用 track
      aTrackId = this.#outFile.addTrack({
        timescale: 1e6,
        duration: 0,
        nb_samples: 0,
        media_duration: 0,
        samplerate: mp4aBox.samplerate,
        channel_count: mp4aBox.channel_count,
        samplesize: mp4aBox.samplesize,
        hdlr: 'soun',
        name: 'SoundHandler',
        type: mp4aBox.type
      })
    }
    if (this.#state !== 'running') {
      this.#state = 'running'
      this.#run({
        vTrackId,
        aTrackId
      }).catch(console.error)
    }
  }

  async #run (
    tIds: {
      vTrackId: number | null
      aTrackId: number | null
    }): Promise<void> {
    const it = this.#findNext(this.#ts)
    if (it == null || this.#outputCanceled) {
      this.#stopOutput()
      return
    }

    const { done, value } = await it.reader.read()
    if (done) {
      it.state = EState.Done
      this.#offsetTs = this.#ts
      console.log(222222, this.#offsetTs)
      this.#run(tIds).catch(console.error)
      return
    }

    // fixme: 跨资源才需要添加偏移值
    // value.dts = this.#offsetTs + value.dts
    // value.cts = this.#offsetTs + value.cts
    let trackId = 0
    if (value.description.type === 'avc1' && tIds.vTrackId != null) {
      trackId = tIds.vTrackId
    } else if (value.description.type === 'mp4a' && tIds.aTrackId != null) {
      trackId = tIds.aTrackId
    } else {
      throw new Error('Unsupport sample type')
    }

    this.#outFile.addSample(trackId, value.data, {
      duration: value.duration / value.timescale * 1e6,
      dts: value.dts / value.timescale * 1e6,
      cts: value.cts / value.timescale * 1e6,
      is_sync: value.is_sync,
      sample_description_index: it.description_index
    })

    this.#ts = value.dts
    this.#run(tIds).catch(console.error)
  }

  // todo: 应该返回 IItem[]
  #findNext (ts: number): IItem | null {
    const items = this.#staticItems.filter(it => it.state !== EState.Done)
    const next = items[0]

    return next ?? null

    // let min = Infinity
    // let idx: number | null = null
    // items.forEach((it, i) => {
    //   const v = it.dur.start - ts
    //   if (v < min) {
    //     min = v
    //     idx = i
    //   }
    // })

    // return idx != null ? this.#staticItems[idx] : null
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
  const deltaBuf = (): ArrayBuffer => {
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
        ctrl.enqueue(deltaBuf())
      }, timeSlice)

      exit = () => {
        clearInterval(timerId)
        file.flush()
        ctrl.enqueue(deltaBuf())
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
