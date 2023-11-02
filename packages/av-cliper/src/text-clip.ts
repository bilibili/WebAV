import { IClip } from './iclip'

interface IEmbedTextOpts {
    color?: string
    textBgColor?: string | null
    type?: 'srt'
    fontFamily?: string
    fontSize?: number
    letterSpacing?: string | null
    // 字幕偏离底部的距离
    bottomOffset?: number
    strokeStyle?: string
    lineWidth?: number | null
    lineCap?: CanvasLineCap | null
    lineJoin?: CanvasLineJoin | null
    textShadow?: {
        offsetX: number
        offsetY: number
        blur: number
        color: string
    }
    videoWidth: number
    videoHeight: number
    duration?: number,
    start?: number
}

declare global {
    interface OffscreenCanvasRenderingContext2D {
        letterSpacing: string
    }
}

export class TextClip implements IClip {
    ready: IClip['ready']

    #text: string

    #opts: Required<IEmbedTextOpts> = {
        color: '#FFF',
        textBgColor: null,
        type: 'srt',
        fontSize: 30,
        letterSpacing: null,
        bottomOffset: 30,
        fontFamily: 'Noto Sans SC',
        strokeStyle: '#000',
        lineWidth: null,
        lineCap: null,
        lineJoin: null,
        textShadow: {
            offsetX: 2,
            offsetY: 2,
            blur: 4,
            color: '#000'
        },
        videoWidth: 1280,
        videoHeight: 720,
        duration: 0,
        start: 0
    }

    #cvs: OffscreenCanvas
    #ctx: OffscreenCanvasRenderingContext2D

    #lastVF: VideoFrame | null = null

    #lineHeight = 0
    #linePadding = 0

    constructor(content: string, opts: IEmbedTextOpts) {
        // this.#subtitles = parseSrt(content).map(({ start, end, text }) => ({
        //   start: start * 1e6,
        //   end: end * 1e6,
        //   text
        // }))
        // if (this.#subtitles.length === 0) throw Error('No subtitles content')
        this.#text = content
        this.#opts = Object.assign(this.#opts, opts)
        // 如果需要绘制背景，则需要给文字添加边距
        this.#linePadding =
            opts.textBgColor == null ? 0 : (opts.fontSize ?? 50) * 0.2

        const { fontSize, fontFamily, videoWidth, videoHeight, letterSpacing } = this.#opts
        this.#lineHeight = fontSize + this.#linePadding * 2
        this.#cvs = new OffscreenCanvas(videoWidth, videoHeight)
        this.#ctx = this.#cvs.getContext('2d')!
        this.#ctx.font = `${fontSize}px ${fontFamily}`
        this.#ctx.textAlign = 'center'
        this.#ctx.textBaseline = 'top'
        this.#ctx.letterSpacing = letterSpacing ?? '0px'

        // 字幕的宽高 由视频画面内容决定
        this.ready = Promise.resolve({
            width: videoWidth,
            height: videoHeight,
            duration: opts.duration ?? 0,
            start: opts.start ?? 0
        })
    }

    #renderTxt() {
        const lines = this.#text
            .split('\n')
            .reverse()
            .map(t => t.trim())

        const { width, height } = this.#cvs

        const {
            color,
            fontSize,
            textBgColor,
            textShadow,
            strokeStyle,
            lineWidth,
            lineCap,
            lineJoin,
            bottomOffset
        } = this.#opts
        const ctx = this.#ctx

        ctx.clearRect(0, 0, width, height)
        ctx.globalAlpha = 0.6
        // 测试canvas背景
        // ctx.fillStyle = 'red'
        // ctx.fillRect(0, 0, this.#cvs.width, this.#cvs.height)

        let bottomDistance = bottomOffset
        for (const lineStr of lines) {
            const txtMeas = ctx.measureText(lineStr)
            const centerX = width / 2
            if (textBgColor != null) {
                ctx.shadowOffsetX = 0
                ctx.shadowOffsetY = 0
                ctx.shadowBlur = 0
                // 字幕背景
                ctx.fillStyle = textBgColor
                ctx.globalAlpha = 0.5
                ctx.fillRect(
                    centerX - txtMeas.actualBoundingBoxLeft - this.#linePadding,
                    height - bottomDistance - this.#lineHeight,
                    txtMeas.width + this.#linePadding * 2,
                    this.#lineHeight
                )
            } else {
            }

            ctx.shadowColor = textShadow.color
            ctx.shadowOffsetX = textShadow.offsetX
            ctx.shadowOffsetY = textShadow.offsetY
            ctx.shadowBlur = textShadow.blur

            ctx.globalAlpha = 1

            if (strokeStyle != null) {
                ctx.lineWidth = lineWidth ?? (fontSize / 6)
                if (lineCap != null) ctx.lineCap = lineCap
                if (lineJoin != null) ctx.lineJoin = lineJoin
                ctx.strokeStyle = strokeStyle
                ctx.strokeText(
                    lineStr,
                    centerX,
                    height - bottomDistance - this.#lineHeight + this.#linePadding
                )
            }

            ctx.fillStyle = color
            ctx.fillText(
                lineStr,
                centerX,
                height - bottomDistance - this.#lineHeight + this.#linePadding
            )

            // 多行，底部偏移距离叠加
            bottomDistance += this.#lineHeight + fontSize * 0.2
        }
    }

    async tick(time: number): Promise<{
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

        if (this.#lastVF != null && time < this.#opts.start) return { video: this.#lastVF.clone(), state: 'success' }
        this.#renderTxt()

        const vf = new VideoFrame(this.#cvs, {
            timestamp: time,
            duration: this.#opts.duration
        })
        this.#lastVF?.close()
        this.#lastVF = vf

        return { video: vf.clone(), state: 'success' }
    }

    destroy() {
        this.#lastVF?.close()
    }
}
