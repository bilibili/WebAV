import { IClip } from './iclip';

interface IEmbedSubtitlesOpts {
  color?: string;
  textBgColor?: string | null;
  type?: 'srt';
  fontFamily?: string;
  fontSize?: number;
  letterSpacing?: string | null;
  // 字幕偏离底部的距离
  bottomOffset?: number;
  strokeStyle?: string;
  lineWidth?: number | null;
  lineCap?: CanvasLineCap | null;
  lineJoin?: CanvasLineJoin | null;
  textShadow?: {
    offsetX: number;
    offsetY: number;
    blur: number;
    color: string;
  };
  videoWidth: number;
  videoHeight: number;
}

declare global {
  interface OffscreenCanvasRenderingContext2D {
    letterSpacing: string;
  }
}

interface SubtitleStruct {
  start: number;
  end: number;
  text: string;
}

/**
 * 嵌入式字幕，将字幕（目前仅支持 SRT 格式）嵌入视频画面中
 *
 * @example
 * const es = new EmbedSubtitlesClip(srtSubtitleStr, {
    videoWidth: 1280,
    videoHeight: 720,
    fontFamily: 'Noto Sans SC',
    color: 'white',
  });
 */
export class EmbedSubtitlesClip implements IClip {
  ready: IClip['ready'];

  #subtitles: SubtitleStruct[] = [];

  #meta = {
    width: 0,
    height: 0,
    duration: 0,
  };

  get meta() {
    return { ...this.#meta };
  }

  #opts: Required<IEmbedSubtitlesOpts> = {
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
      color: '#000',
    },
    videoWidth: 1280,
    videoHeight: 720,
  };

  #cvs: OffscreenCanvas;
  #ctx: OffscreenCanvasRenderingContext2D;

  #lastVF: VideoFrame | null = null;

  #lineHeight = 0;
  #linePadding = 0;

  constructor(content: string | SubtitleStruct[], opts: IEmbedSubtitlesOpts) {
    this.#subtitles = Array.isArray(content)
      ? content
      : parseSrt(content).map(({ start, end, text }) => ({
          start: start * 1e6,
          end: end * 1e6,
          text,
        }));
    if (this.#subtitles.length === 0) throw Error('No subtitles content');

    this.#opts = Object.assign(this.#opts, opts);
    // 如果需要绘制背景，则需要给文字添加边距
    this.#linePadding =
      opts.textBgColor == null ? 0 : (opts.fontSize ?? 50) * 0.2;

    const { fontSize, fontFamily, videoWidth, videoHeight, letterSpacing } =
      this.#opts;
    this.#lineHeight = fontSize + this.#linePadding * 2;
    this.#cvs = new OffscreenCanvas(videoWidth, videoHeight);
    this.#ctx = this.#cvs.getContext('2d')!;
    this.#ctx.font = `${fontSize}px ${fontFamily}`;
    this.#ctx.textAlign = 'center';
    this.#ctx.textBaseline = 'top';
    this.#ctx.letterSpacing = letterSpacing ?? '0px';

    this.#meta = {
      width: videoWidth,
      height: videoHeight,
      duration: this.#subtitles.at(-1)?.end ?? 0,
    };
    // 字幕的宽高 由视频画面内容决定
    this.ready = Promise.resolve(this.meta);
  }

  #renderTxt(txt: string) {
    const lines = txt
      .split('\n')
      .reverse()
      .map((t) => t.trim());

    const { width, height } = this.#cvs;

    const {
      color,
      fontSize,
      textBgColor,
      textShadow,
      strokeStyle,
      lineWidth,
      lineCap,
      lineJoin,
      bottomOffset,
    } = this.#opts;
    const ctx = this.#ctx;

    ctx.clearRect(0, 0, width, height);
    ctx.globalAlpha = 0.6;
    // 测试canvas背景
    // ctx.fillStyle = 'red'
    // ctx.fillRect(0, 0, this.#cvs.width, this.#cvs.height)

    let bottomDistance = bottomOffset;
    for (const lineStr of lines) {
      const txtMeas = ctx.measureText(lineStr);
      const centerX = width / 2;
      if (textBgColor != null) {
        ctx.shadowOffsetX = 0;
        ctx.shadowOffsetY = 0;
        ctx.shadowBlur = 0;
        // 字幕背景
        ctx.fillStyle = textBgColor;
        ctx.globalAlpha = 0.5;
        ctx.fillRect(
          centerX - txtMeas.actualBoundingBoxLeft - this.#linePadding,
          height - bottomDistance - this.#lineHeight,
          txtMeas.width + this.#linePadding * 2,
          this.#lineHeight,
        );
      } else {
      }

      ctx.shadowColor = textShadow.color;
      ctx.shadowOffsetX = textShadow.offsetX;
      ctx.shadowOffsetY = textShadow.offsetY;
      ctx.shadowBlur = textShadow.blur;

      ctx.globalAlpha = 1;

      if (strokeStyle != null) {
        ctx.lineWidth = lineWidth ?? fontSize / 6;
        if (lineCap != null) ctx.lineCap = lineCap;
        if (lineJoin != null) ctx.lineJoin = lineJoin;
        ctx.strokeStyle = strokeStyle;
        ctx.strokeText(
          lineStr,
          centerX,
          height - bottomDistance - this.#lineHeight + this.#linePadding,
        );
      }

      ctx.fillStyle = color;
      ctx.fillText(
        lineStr,
        centerX,
        height - bottomDistance - this.#lineHeight + this.#linePadding,
      );

      // 多行，底部偏移距离叠加
      bottomDistance += this.#lineHeight + fontSize * 0.2;
    }
  }

  /**
   * @see {@link IClip.tick}
   */
  async tick(time: number): Promise<{
    video?: VideoFrame;
    state: 'done' | 'success';
  }> {
    if (
      this.#lastVF != null &&
      time >= this.#lastVF.timestamp &&
      time <= this.#lastVF.timestamp + (this.#lastVF.duration ?? 0)
    ) {
      return { video: this.#lastVF.clone(), state: 'success' };
    }

    let i = 0;
    for (; i < this.#subtitles.length; i += 1) {
      if (time <= this.#subtitles[i].end) break;
    }

    const it = this.#subtitles[i] ?? this.#subtitles.at(-1);
    if (time > it.end) return { state: 'done' };
    if (time < it.start) {
      // 此时无字幕内容，清空画布
      this.#ctx.clearRect(0, 0, this.#cvs.width, this.#cvs.height);
      const vf = new VideoFrame(this.#cvs, {
        timestamp: time,
        // 直到下个字幕出现的时机
        duration: it.start - time,
      });
      this.#lastVF?.close();
      this.#lastVF = vf;

      return { video: vf.clone(), state: 'success' };
    }

    this.#renderTxt(it.text);

    const vf = new VideoFrame(this.#cvs, {
      timestamp: time,
      duration: it.end - time,
    });
    this.#lastVF?.close();
    this.#lastVF = vf;

    return { video: vf.clone(), state: 'success' };
  }

  /**
   * @see {@link IClip.destroy}
   */
  async split(time: number) {
    await this.ready;
    let hitIdx = -1;
    for (let i = 0; i < this.#subtitles.length; i++) {
      const sub = this.#subtitles[i];
      if (time > sub.start) continue;
      hitIdx = i;
      break;
    }
    if (hitIdx === -1) throw Error('Not found subtitle by time');
    const preSlice = this.#subtitles.slice(0, hitIdx).map((s) => ({ ...s }));
    let preLastIt = preSlice.at(-1);
    let postFirstIt = null;
    // 切割时间命中字幕区间，需要将当前字幕元素拆成前后两份
    if (preLastIt != null && preLastIt.end > time) {
      postFirstIt = {
        start: 0,
        end: preLastIt.end - time,
        text: preLastIt.text,
      };

      preLastIt.end = time;
    }
    const postSlice = this.#subtitles
      .slice(hitIdx)
      .map((s) => ({ ...s, start: s.start - time, end: s.end - time }));
    if (postFirstIt != null) postSlice.unshift(postFirstIt);
    return [
      new EmbedSubtitlesClip(preSlice, this.#opts),
      new EmbedSubtitlesClip(postSlice, this.#opts),
    ] as [this, this];
  }

  /**
   * @see {@link IClip.clone}
   */
  async clone() {
    return new EmbedSubtitlesClip(this.#subtitles.slice(0), this.#opts) as this;
  }

  /**
   * @see {@link IClip.destroy}
   */
  destroy() {
    this.#lastVF?.close();
  }
}

// SRT字幕格式 https://www.cnblogs.com/tocy/p/subtitle-format-srt.html
function srtTimeToSeconds(time: string) {
  const match = time.match(/(\d{2}):(\d{2}):(\d{2}),(\d{3})/);
  if (match == null) throw Error(`time format error: ${time}`);

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = Number(match[3]);
  const milliseconds = Number(match[4]);

  return hours * 60 * 60 + minutes * 60 + seconds + milliseconds / 1000;
}

function parseSrt(srt: string) {
  return (
    srt
      .split(/\r|\n/)
      .map((s) => s.trim())
      .filter((str) => str.length > 0)
      // 匹配时间戳标记行，匹配失败的为字幕内容
      .map((s) => ({
        lineStr: s,
        match: s.match(
          /(\d{2}:\d{2}:\d{2},\d{3}) --> (\d{2}:\d{2}:\d{2},\d{3})/,
        ),
      }))
      // 过滤掉时间上一行的数字标记
      .filter(
        ({ lineStr }, idx, source) =>
          !(/^\d+$/.test(lineStr) && source[idx + 1]?.match != null),
      )
      // 按时间标记行聚合，拼接字幕内容到 text 字段
      .reduce(
        (acc, { lineStr, match }) => {
          if (match == null) {
            const last = acc.at(-1);
            if (last == null) return acc;

            last.text += last.text.length === 0 ? lineStr : `\n${lineStr}`;
          } else {
            acc.push({
              start: srtTimeToSeconds(match[1]),
              end: srtTimeToSeconds(match[2]),
              text: '',
            });
          }

          return acc;
        },
        [] as Array<{
          start: number;
          end: number;
          text: string;
        }>,
      )
  );
}
