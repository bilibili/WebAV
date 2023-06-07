import { IClip } from './iclip'

interface IEmbedSubtitlesOpts {
  color?: string
  textBgColor?: string | null
  type?: 'srt'
  fontFamily?: string
  fontSize?: number
  videoWidth: number
  videoHeight: number
}

export class EmbedSubtitlesClip implements IClip {
  ready: IClip['ready']

  #subtitles: Array<{
    start: number
    end: number
    text: string
  }> = []

  #opts: Required<IEmbedSubtitlesOpts> = {
    color: '#FFF',
    textBgColor: null,
    type: 'srt',
    fontSize: 30,
    fontFamily: 'Microsoft YaHei',
    videoWidth: 1280,
    videoHeight: 720
  }

  #cvs: OffscreenCanvas
  #ctx: OffscreenCanvasRenderingContext2D

  #lastVF: VideoFrame | null = null

  #lineHeight = 0
  #linePadding = 0

  constructor (content: string, opts: IEmbedSubtitlesOpts) {
    this.#subtitles = parseSrt(content).map(({ start, end, text }) => ({
      start: start * 1e6,
      end: end * 1e6,
      text
    }))
    if (this.#subtitles.length === 0) throw Error('No subtitles content')

    this.#opts = Object.assign(this.#opts, opts)
    // 如果需要绘制背景，则需要给文字添加边距
    this.#linePadding =
      opts.textBgColor == null ? 0 : (opts.fontSize ?? 50) * 0.2

    const { fontSize, fontFamily, videoWidth, videoHeight } = this.#opts
    this.#lineHeight = fontSize + this.#linePadding * 2
    this.#cvs = new OffscreenCanvas(videoWidth, videoHeight)
    this.#ctx = this.#cvs.getContext('2d')!
    this.#ctx.font = `${fontSize}px ${fontFamily}`
    this.#ctx.textAlign = 'center'
    this.#ctx.textBaseline = 'top'

    // 字幕的宽高 由视频画面内容决定
    this.ready = Promise.resolve({
      width: videoWidth,
      height: videoHeight,
      duration: this.#subtitles.at(-1)?.end ?? 0
    })
  }

  #renderTxt (txt: string) {
    const lines = txt
      .split('\n')
      .reverse()
      .map(t => t.trim())

    const { width, height } = this.#cvs

    const { color, fontSize, textBgColor } = this.#opts
    const ctx = this.#ctx

    ctx.clearRect(0, 0, width, height)
    ctx.globalAlpha = 0.6
    // 测试canvas背景
    // ctx.fillStyle = 'red'
    // ctx.fillRect(0, 0, this.#cvs.width, this.#cvs.height)

    let offsetBottom = fontSize * 0.5
    for (const lineStr of lines) {
      const txtMeas = ctx.measureText(lineStr)
      const centerY = width / 2
      if (textBgColor != null) {
        ctx.shadowOffsetX = 0
        ctx.shadowOffsetY = 0
        ctx.shadowBlur = 0
        // 字幕背景
        ctx.fillStyle = textBgColor
        ctx.globalAlpha = 0.5
        ctx.fillRect(
          centerY - txtMeas.actualBoundingBoxLeft - this.#linePadding,
          height - offsetBottom - this.#lineHeight,
          txtMeas.width + this.#linePadding * 2,
          this.#lineHeight
        )
      } else {
      }

      ctx.shadowColor = '#000'
      ctx.shadowOffsetX = 2
      ctx.shadowOffsetY = 2
      ctx.shadowBlur = 2

      ctx.globalAlpha = 1

      ctx.fillStyle = color
      ctx.fillText(
        lineStr,
        centerY,
        height - offsetBottom - this.#lineHeight + this.#linePadding
      )

      offsetBottom += this.#lineHeight + fontSize * 0.2
    }
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

    this.#renderTxt(it.text)

    const vf = new VideoFrame(this.#cvs, {
      timestamp: time,
      duration: it.end - time
    })
    this.#lastVF?.close()
    this.#lastVF = vf

    return { video: vf.clone(), state: 'success' }
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
    /(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})(?:\r|\n)+((?:.|(?:\r|\n))*)/m
  )

  if (match == null) throw Error(`line format error: ${line}`)

  return {
    start: srtTimeToSeconds(match[1]),
    end: srtTimeToSeconds(match[2]),
    // fixme: 换行字幕没有第二行
    text: match[3].trim()
  }
}

function parseSrt (srt: string) {
  // fixme: 当某行字幕全是数字时，解析结果错误
  const lines = srt
    .trim()
    // 第一个序号和换行符
    .replace(/\d+(?:\r|\n)*/, '')
    .split(/(?:\r|\n)+\d+(?:\r|\n)+/g)

  return lines.map(line => parseSrtLine(line))
}
