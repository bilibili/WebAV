
interface FileSystemSyncAccessHandle {
  read: (container: ArrayBuffer, opts: { at: number }) => void
  write: (data: ArrayBuffer) => number
  flush: () => void
  getSize: () => number
}

export class OPFSFileWrap {
  #worker: Worker

  #cbId = 0

  #cbFns: Record<number, Function> = {}
  #initReady: Promise<unknown>

  constructor(fileName: string) {
    const createWorker = (): Worker => {
      const blob = new Blob([`(${opfsWorkerSetup.toString()})()`])
      const url = URL.createObjectURL(blob)
      return new Worker(url)
    }
    this.#worker = createWorker()
    this.#worker.onmessage = this.#onMsg
    this.#initReady = this.#postMsg('create', { fileName })
  }

  async #postMsg(evtType: 'create' | 'write' | 'read', args: any) {
    if (evtType !== 'create') await this.#initReady
    const cbId = this.#cbId
    this.#cbId += 1

    const rsP = new Promise((resolve) => {
      this.#cbFns[cbId] = resolve
    })

    this.#worker.postMessage({
      cbId,
      evtType,
      args
    })
    return rsP
  }

  #onMsg = ({ data }: { data: { cbId: number, returnVal: unknown, evtType: string } }) => {
    if (data.evtType === 'callback') {
      this.#cbFns[data.cbId]?.(data.returnVal)
    }
  }

  async write(data: ArrayBuffer) {
    return await this.#postMsg('write', { data })
  }

  async read(offset: number, size: number) {
    return await this.#postMsg('read', { offset, size }) as ArrayBuffer
  }
}

const opfsWorkerSetup = (): void => {
  let accessHandle: FileSystemSyncAccessHandle

  async function createFile(fileName: string) {
    const root = await navigator.storage.getDirectory();
    const draftHandle = await root.getFileHandle(fileName, { create: true });
    // @ts-expect-error
    accessHandle = await draftHandle.createSyncAccessHandle()
  }

  self.onmessage = async e => {
    let returnVal
    if (e.data.evtType === 'create') {
      await createFile(e.data.args.fileName as string)
    } else if (e.data.evtType === 'write') {
      accessHandle.write(e.data.args.data)
      accessHandle.flush()
    } else if (e.data.evtType === 'read') {
      const { offset, size } = e.data.args
      const ab = new ArrayBuffer(size)
      accessHandle.read(ab, { at: offset })
      returnVal = ab
    }
    const trans: Transferable[] = []
    if (returnVal instanceof ArrayBuffer) trans.push(returnVal)
    self.postMessage({
      evtType: 'callback',
      cbId: e.data.cbId,
      returnVal
      // @ts-expect-error
    }, trans)
  }
}