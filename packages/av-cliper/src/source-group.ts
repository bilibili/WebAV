
interface IDuration {
  start: number
  end: number
}

enum EState {
  Pending = 'pending',
  Reading = 'reading',
  Done = 'done'
}

interface IItem {
  dur: IDuration
  source: ReadableStream
  reader: ReadableStreamDefaultReader<{ timestamp: number }>
  state: EState
}

export class SourceGroup {
  #items: IItem[] = []

  #ts = 0

  #state = 'pending'

  #ctrl: ReadableStreamDefaultController | null = null

  outputStream: ReadableStream<any>

  constructor () {
    this.outputStream = new ReadableStream({
      start: (ctrl) => {
        this.#ctrl = ctrl
      }
    })
  }

  add (dur: IDuration, source: ReadableStream): void {
    this.#items.push({
      dur,
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

  async #run (ctrl: ReadableStreamDefaultController): Promise<void> {
    const it = this.#findNext(this.#ts)
    if (it == null) {
      this.#ctrl?.close()
      return
    }

    const { done, value } = await it.reader.read()
    if (done) {
      it.state = EState.Done
      this.#run(ctrl).catch(ctrl.error)
      return
    }

    this.#ts = it.dur.start + value.timestamp
    value.timestamp = this.#ts
    // todo：发送一个数组
    ctrl.enqueue(value)
    this.#run(ctrl).catch(ctrl.error)
  }

  // todo: 应该返回 IItem[]
  #findNext (ts: number): IItem | null {
    const items = this.#items.filter(it => it.state !== EState.Done)
    const next = items.find(it => it.dur.start <= ts)

    if (next != null) return next

    let min = Infinity
    let idx: number | null = null
    items.forEach((it, i) => {
      const v = it.dur.start - ts
      if (v < min) {
        min = v
        idx = i
      }
    })

    return idx != null ? this.#items[idx] : null
  }
}
