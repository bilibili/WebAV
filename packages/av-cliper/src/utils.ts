import mp4box, { MP4File, TrakBoxParser } from 'mp4box'

export function convertFile2Stream (
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
        console.log(1222, buf)
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

// track is H.264 or H.265.
export function parseVideoCodecDesc (track: TrakBoxParser): Uint8Array {
  for (const entry of track.mdia.minf.stbl.stsd.entries) {
    if ('avcC' in entry || 'hvcC ' in entry) {
      const stream = new mp4box.DataStream(
        undefined,
        0,
        mp4box.DataStream.BIG_ENDIAN
      )
      // @ts-expect-error
      const box = 'avcC' in entry ? entry.avcC : entry.hvcC
      box.write(stream)
      return new Uint8Array(stream.buffer, 8) // Remove the box header.
    }
  }
  throw Error('avcC or hvcC not found')
}

export async function sleep (time: number): Promise<void> {
  return await new Promise((resolve) => {
    setTimeout(resolve, time)
  })
}
