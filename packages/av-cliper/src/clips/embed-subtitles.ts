import { IClip } from './iclip'

interface IEmbedSubtitlesOpts {
  color: string
  type: 'srt'
  fontSize: number
}

export class EmbedSubtitles implements IClip {
  ready: Promise<{ width: number; height: number }>

  #subtitles: Array<{
    start: number
    end: number
    text: string
  }> = []

  #opts: IEmbedSubtitlesOpts = {
    color: '#FFF',
    type: 'srt',
    fontSize: 24
  }

  #cvs: OffscreenCanvas
  #ctx: OffscreenCanvasRenderingContext2D

  #lastVF: VideoFrame | null = null

  constructor (content: string, opts?: Partial<IEmbedSubtitlesOpts>) {
    this.#subtitles = parseSrt(content).map(({ start, end, text }) => ({
      start: start * 1e6,
      end: end * 1e6,
      text
    }))
    if (this.#subtitles.length === 0) throw Error('No subtitles content')

    this.#opts = Object.assign(this.#opts, opts)
    this.#cvs = new OffscreenCanvas(1280, 720)
    this.#ctx = this.#cvs.getContext('2d')!
    this.#ctx.fillStyle = this.#opts.color

    // 字幕的宽高 由内容决定
    this.ready = Promise.resolve({ width: 0, height: 0 })
  }

  async tick (time: number): Promise<{
    video?: VideoFrame
    state: 'done' | 'success'
  }> {
    if (
      this.#lastVF != null &&
      time >= this.#lastVF.timestamp &&
      time <= this.#lastVF.timestamp + (this.#lastVF.duration ?? 0)
    ) {
      return { video: this.#lastVF.clone(), state: 'success' }
    }

    let i = 0
    for (; i < this.#subtitles.length; i += 1) {
      if (time <= this.#subtitles[i].end) break
    }

    const it = this.#subtitles[i] ?? this.#subtitles.at(-1)
    if (time > it.end) return { state: 'done' }
    if (time < it.start) {
      // 此时无字幕内容，清空画布
      this.#ctx.clearRect(0, 0, this.#cvs.width, this.#cvs.height)
      const vf = new VideoFrame(this.#cvs, {
        timestamp: time,
        // 直到下个字幕出现的时机
        duration: it.start - time
      })
      this.#lastVF?.close()
      this.#lastVF = vf

      return { video: vf.clone(), state: 'success' }
    }

    this.#ctx.fillText(it.text, 0, 0)

    const vf = new VideoFrame(this.#cvs, {
      timestamp: time,
      duration: it.end - time
    })
    this.#lastVF?.close()
    this.#lastVF = vf

    return {
      video: vf.clone(),
      state: 'success'
    }
  }

  destroy () {
    this.#lastVF?.close()
  }
}

// SRT字幕格式 https://www.cnblogs.com/tocy/p/subtitle-format-srt.html
function srtTimeToSeconds (time: string) {
  const match = time.match(/(\d{2}):(\d{2}):(\d{2}),(\d{3})/)
  if (match == null) throw Error(`time format error: ${time}`)

  const hours = Number(match[1])
  const minutes = Number(match[2])
  const seconds = Number(match[3])
  const milliseconds = Number(match[4])

  return hours * 60 * 60 + minutes * 60 + seconds + milliseconds / 1000
}

function parseSrtLine (line: string) {
  const match = line.match(
    /(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})\n((?:.|\n)*)/m
  )

  if (match == null) throw Error(`line format error: ${line}`)

  return {
    start: srtTimeToSeconds(match[1]),
    end: srtTimeToSeconds(match[2]),
    text: match[3].trim()
  }
}

function parseSrt (srt: string) {
  const lines = srt
    .trim()
    // 第一个序号和换行符
    .replace(/\d+\n/, '')
    .split(/\n\n\d+\n/g)

  return lines.map(line => parseSrtLine(line))
}
