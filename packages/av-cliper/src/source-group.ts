import { MP4Sample } from 'mp4box'

enum EState {
  Pending = 'pending',
  Reading = 'reading',
  Done = 'done'
}

interface IItem {
  source: ReadableStream
  reader: ReadableStreamDefaultReader<MP4Sample>
  state: EState
}

export class SourceGroup {
  #staticItems: IItem[] = []

  #ts = 0

  #offsetTs = 0

  #state = 'pending'

  #ctrl: ReadableStreamDefaultController<MP4Sample> | null = null

  outputStream: ReadableStream<MP4Sample>

  constructor () {
    this.outputStream = new ReadableStream({
      start: (ctrl) => {
        this.#ctrl = ctrl
      }
    })
  }

  add (source: ReadableStream): void {
    this.#staticItems.push({
      source,
      reader: source.getReader(),
      state: EState.Pending
    })
  }

  start (): void {
    if (this.#state !== 'running' && this.#ctrl != null) {
      this.#state = 'running'
      this.#run(this.#ctrl).catch(this.#ctrl.error)
    }
  }

  async #run (ctrl: ReadableStreamDefaultController<MP4Sample>): Promise<void> {
    const it = this.#findNext(this.#ts)
    if (it == null) {
      this.#ctrl?.close()
      return
    }

    const { done, value } = await it.reader.read()
    if (done) {
      it.state = EState.Done
      this.#offsetTs = this.#ts
      console.log(222222, this.#offsetTs)
      this.#run(ctrl).catch(ctrl.error)
      return
    }

    // fixme: 跨资源才需要添加偏移值
    // value.dts = this.#offsetTs + value.dts
    // value.cts = this.#offsetTs + value.cts
    this.#ts = value.dts
    // todo：发送一个数组
    ctrl.enqueue(value)
    this.#run(ctrl).catch(ctrl.error)
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
