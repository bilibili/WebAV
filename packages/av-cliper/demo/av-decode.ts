import mp4box from 'mp4box'
import { demuxMP4Stream } from '../src/mp4-source'
import { convertFile2Stream, sleep } from '../src/utils'
import { MP4FrameQueue } from '../src/mp4-frame-queue'

document.querySelector('#decode-mp4-to-stream')?.addEventListener('click', () => {
  ;(async () => {
    const resp = await fetch('./assets/0.mp4')
    const { stream, startDemux } = demuxMP4Stream(
      resp.body as ReadableStream<Uint8Array>,
      (info) => {
        console.log('ready: ', info)
      }
    )

    startDemux()
    const reader = stream.getReader()
    while (true) {
      const { done, value } = await reader.read()
      if (done) return
      console.log('----', value)
      value.close()
    }
  })().catch(console.error)
})

const cvs = document.querySelector('#canvas') as HTMLCanvasElement
const ctx = cvs.getContext('2d')
document.querySelector('#decode-mp4-frames')?.addEventListener('click', () => {
  ;(async () => {
    const resp = await fetch('./assets/0.mp4')
    const frameQ = new MP4FrameQueue(resp.body as ReadableStream<Uint8Array>)

    await frameQ.ready

    let time = 0
    console.time('parse time')
    while (true) {
      const { frame, state } = await frameQ.forward(time)
      time += 1000 / 30 * 1000
      // console.log(111111, time, frame, cnt, state)
      if (state === 'next') {
        continue
      }
      if (state === 'done') {
        console.log('----- end -----')
        console.timeEnd('parse time')
        return
      }
      if (frame == null) {
        console.log('?????')
        await sleep(0)
        continue
      }
      ctx?.drawImage(frame, 0, 0, frame.codedWidth, frame.codedHeight)
      frame.close()
    }
  })().catch(console.error)
})

document.querySelector('#decode-mp3')?.addEventListener('click', () => {
  ;(async () => {
    const files = await getLocalFiles({
      multiple: false,
      accept: { 'audio/*': ['.mp3'] }
    })
    const audioCtx = new AudioContext()
    await audioCtx.decodeAudioData(await files[0].arrayBuffer(), (ab) => {
      console.log(3333, ab)
      // duration : 4.4875
      // length : 215400
      // numberOfChannels : 1
      // sampleRate : 48000
      const frameCnt = ab.sampleRate * ab.duration * 2
      const buf = new Float32Array(frameCnt)
      const chan0Buf = ab.getChannelData(0)
      buf.set(chan0Buf, 0)
      if (ab.numberOfChannels >= 2) {
        buf.set(ab.getChannelData(1), chan0Buf.length)
      } else {
        buf.set(chan0Buf, chan0Buf.length)
      }

      const mp4file = mp4box.createFile()
      const aTrackId = mp4file.addTrack({
        timescale: 1e6,
        samplerate: ab.sampleRate,
        channel_count: ab.numberOfChannels,
        hdlr: 'soun',
        name: 'SoundHandler',
        type: 'mp4a'
      })
      const ad = new AudioData({
        numberOfChannels: 2,
        numberOfFrames: ab.sampleRate * ab.duration,
        sampleRate: ab.sampleRate,
        timestamp: 0,
        format: 'f32-planar',
        data: buf
      })

      let endTimer = 0
      function resetEndTimer (): void {
        clearTimeout(endTimer)
        endTimer = self.setTimeout(() => {
          ;(async () => {
            const { stream, stop } = convertFile2Stream(mp4file, 500, () => {
              console.log(1111)
            })
            setTimeout(() => {
              stop()
            }, 1000)
            await stream.pipeTo(await createFileWriter('mp4'))
          })().catch(console.error)
        }, 1000)
      }

      const ae = new AudioEncoder({
        output: (chunk, meta) => {
          console.log(99999, { chunk, meta })
          const buf = new ArrayBuffer(chunk.byteLength)
          chunk.copyTo(buf)
          const dts = chunk.timestamp
          mp4file.addSample(aTrackId, buf, {
            duration: chunk.duration ?? 0,
            dts,
            cts: dts,
            is_sync: chunk.type === 'key'
          })
          resetEndTimer()
        },
        error: console.error
      })
      ae.configure({
        codec: 'mp4a.40.2',
        numberOfChannels: 2,
        sampleRate: 48000
      })
      ae.encode(ad)
      console.log(111, ad)
    }, console.error)
  })().catch(console.error)
})

async function getLocalFiles (
  { multiple, accept }: {
    multiple: boolean
    accept: Record<string, string[]>
  }
): Promise<File[]> {
  const fhs = await (window as any).showOpenFilePicker({
    startIn: 'downloads',
    types: [{ accept }],
    multiple
  })
  return await Promise.all(
    fhs.map(async (fh: FileSystemFileHandle) => await fh.getFile())
  )
}

async function createFileWriter (extName: string): Promise<FileSystemWritableFileStream> {
  const fileHandle = await window.showSaveFilePicker({
    suggestedName: `WebAv-export-${Date.now()}.${extName}`
  })
  return await fileHandle.createWritable()
}
