import {
  workerTimer,
  mixinPCM,
  Log,
  Rect,
  TCtrlKey,
  EventTool,
  Combinator,
  OffscreenSprite,
} from '@webav/av-cliper';
import { renderCtrls } from './sprites/render-ctrl';
import { ESpriteManagerEvt, SpriteManager } from './sprites/sprite-manager';
import { activeSprite, draggabelSprite } from './sprites/sprite-op';
import { IResolution } from './types';
import { createEl } from './utils';

function createInitCvsEl(resolution: IResolution): HTMLCanvasElement {
  const cvsEl = createEl('canvas') as HTMLCanvasElement;
  cvsEl.style.cssText = `
    width: 100%;
    height: 100%;
  `;
  cvsEl.width = resolution.width;
  cvsEl.height = resolution.height;

  return cvsEl;
}

export class AVCanvas {
  #cvsEl: HTMLCanvasElement;

  #spriteManager: SpriteManager;

  #cvsCtx: CanvasRenderingContext2D;

  #destroyed = false;

  #clears: Array<() => void> = [];
  #stopRender: () => void;

  #evtTool = new EventTool<{
    timeupdate: (time: number) => void;
    paused: () => void;
    playing: () => void;
  }>();
  on = this.#evtTool.on;

  #opts;

  constructor(
    attchEl: HTMLElement,
    opts: {
      bgColor: string;
    } & IResolution
  ) {
    this.#opts = opts;
    this.#cvsEl = createInitCvsEl(opts);
    const ctx = this.#cvsEl.getContext('2d', { alpha: false });
    if (ctx == null) throw Error('canvas context is null');
    this.#cvsCtx = ctx;
    const container = createEl('div');
    container.style.cssText =
      'width: 100%; height: 100%; position: relative; overflow: hidden;';
    container.appendChild(this.#cvsEl);
    attchEl.appendChild(container);

    Rect.CTRL_SIZE = 14 / (this.#cvsEl.clientWidth / this.#cvsEl.width);
    this.#spriteManager = new SpriteManager();

    this.#clears.push(
      // 鼠标样式、控制 sprite 依赖 activeSprite，
      // activeSprite 需要在他们之前监听到 mousedown 事件 (代码顺序需要靠前)
      activeSprite(this.#cvsEl, this.#spriteManager),
      dynamicCusor(this.#cvsEl, this.#spriteManager),
      draggabelSprite(this.#cvsEl, this.#spriteManager),
      renderCtrls(container, this.#cvsEl, this.#spriteManager),
      this.#spriteManager.on(ESpriteManagerEvt.AddSprite, (s) => {
        const { rect } = s;
        // 默认居中
        if (rect.x === 0 && rect.y === 0) {
          rect.x = (this.#cvsEl.width - rect.w) / 2;
          rect.y = (this.#cvsEl.height - rect.h) / 2;
        }
      })
    );

    let lastTime = this.#renderTime;
    this.#stopRender = workerTimer(() => {
      this.#cvsCtx.fillStyle = opts.bgColor;
      this.#cvsCtx.fillRect(0, 0, this.#cvsEl.width, this.#cvsEl.height);
      this.#render();

      if (lastTime !== this.#renderTime) {
        lastTime = this.#renderTime;
        this.#evtTool.emit('timeupdate', Math.round(lastTime));
      }
    }, 1000 / 30);

    // ;(window as any).cvsEl = this.#cvsEl
  }

  #renderTime = 0e6;
  #updateRenderTime(time: number) {
    this.#renderTime = time;
    this.#spriteManager.updateRenderTime(time);
  }

  #audioCtx = new AudioContext();
  #render() {
    const cvsCtx = this.#cvsCtx;
    let ts = this.#renderTime;
    if (
      this.#playState.step !== 0 &&
      ts >= this.#playState.start &&
      ts < this.#playState.end
    ) {
      ts += this.#playState.step;
    } else {
      if (this.#playState.step !== 0) {
        this.#evtTool.emit('paused');
      }
      this.#playState.step = 0;
    }
    this.#updateRenderTime(ts);

    const audios: Float32Array[][] = [];
    for (const s of this.#spriteManager.getSprites()) {
      cvsCtx.save();
      const { audio } = s.render(cvsCtx, ts - s.time.offset);
      cvsCtx.restore();
      audios.push(audio);
    }
    cvsCtx.resetTransform();

    if (this.#playState.step !== 0 && audios.length > 0) {
      this.#playState.audioPlayAt = Math.max(
        this.#audioCtx.currentTime,
        this.#playState.audioPlayAt
      );
      const duration = renderPCM(
        mixinPCM(audios),
        this.#playState.audioPlayAt,
        this.#audioCtx
      );
      this.#playState.audioPlayAt += duration;
    }
  }

  #playState = {
    start: 0,
    end: 0,
    // paused state when step equal 0
    step: 0,
    // step: (1000 / 30) * 1000,
    audioPlayAt: 0,
  };
  play(opts: { start: number; end?: number; playbackRate?: number }) {
    const end =
      opts.end ??
      Math.max(
        ...this.#spriteManager
          .getSprites({ time: false })
          .map((s) => s.time.offset + s.time.duration)
      );
    if (!Number.isFinite(end) || opts.start >= end || opts.start < 0) {
      throw Error(
        `Invalid time parameter, ${JSON.stringify({ start: opts.start, end })}`
      );
    }
    this.#updateRenderTime(opts.start);
    this.#playState.start = opts.start;
    this.#playState.end = end;
    // AVCanvas 30FPS，将播放速率转换成步长
    this.#playState.step = (opts.playbackRate ?? 1) * (1000 / 30) * 1000;
    this.#playState.audioPlayAt = 0;

    this.#evtTool.emit('playing');
    Log.info('AVCanvs play by:', this.#playState);
  }
  pause() {
    this.#playState.step = 0;
  }
  previewFrame(time: number) {
    this.#updateRenderTime(time);
    this.#playState.step = 0;
  }

  // proxy to SpriteManager
  addSprite: SpriteManager['addSprite'] = (...args) =>
    this.#spriteManager.addSprite(...args);
  removeSprite: SpriteManager['removeSprite'] = (...args) =>
    this.#spriteManager.removeSprite(...args);

  destroy(): void {
    if (this.#destroyed) return;
    this.#destroyed = true;

    this.#audioCtx.close();
    this.#stopRender();
    this.#cvsEl.parentElement?.remove();
    this.#clears.forEach((fn) => fn());
    this.#spriteManager.destroy();
  }

  captureStream(): MediaStream {
    const ms = new MediaStream();
    this.#cvsEl
      .captureStream()
      .getTracks()
      // .concat(this.#spriteManager.audioMSDest.stream.getTracks())
      .forEach((t) => {
        ms.addTrack(t);
      });
    Log.info(
      'AVCanvas.captureStream, tracks:',
      ms.getTracks().map((t) => t.kind)
    );
    return ms;
  }

  async createCombinator(opts: { bitrate?: number } = {}) {
    const com = new Combinator({ ...this.#opts, ...opts });
    const sprites = this.#spriteManager.getSprites({ time: false });
    if (sprites.length === 0) throw Error('No sprite added');

    for (const vs of sprites) {
      const os = new OffscreenSprite(vs.getClip());
      os.time = { ...vs.time };
      vs.copyStateTo(os);
      await com.addSprite(os);
    }
    return com;
  }
}

function renderPCM(pcm: Float32Array, at: number, ctx: AudioContext) {
  const len = pcm.length;
  if (len === 0) return 0;
  // streo is default
  const buf = ctx.createBuffer(2, pcm.length / 2, 48000);
  buf.copyToChannel(new Float32Array(pcm, 0, pcm.byteLength / 2), 0);
  buf.copyToChannel(new Float32Array(pcm, pcm.byteLength / 2), 1);
  const audioSource = ctx.createBufferSource();
  audioSource.buffer = buf;
  audioSource.connect(ctx.destination);
  audioSource.start(at);
  return buf.duration;
}

/**
 * 根据当前位置（sprite & ctrls），动态调整鼠标样式
 */
function dynamicCusor(
  cvsEl: HTMLCanvasElement,
  sprMng: SpriteManager
): () => void {
  const cvsRatio = {
    w: cvsEl.clientWidth / cvsEl.width,
    h: cvsEl.clientHeight / cvsEl.height,
  };

  const observer = new ResizeObserver(() => {
    cvsRatio.w = cvsEl.clientWidth / cvsEl.width;
    cvsRatio.h = cvsEl.clientHeight / cvsEl.height;
  });
  observer.observe(cvsEl);

  const cvsStyle = cvsEl.style;

  let actSpr = sprMng.activeSprite;
  sprMng.on(ESpriteManagerEvt.ActiveSpriteChange, (s) => {
    actSpr = s;
    if (s == null) cvsStyle.cursor = '';
  });
  // 鼠标按下时，在操作过程中，不需要变换鼠标样式
  let isMSDown = false;
  const onDown = ({ offsetX, offsetY }: MouseEvent): void => {
    isMSDown = true;
    // 将鼠标点击偏移坐标映射成 canvas 坐，
    const ofx = offsetX / cvsRatio.w;
    const ofy = offsetY / cvsRatio.h;
    // 直接选中 sprite 时，需要改变鼠标样式为 move
    if (actSpr?.rect.checkHit(ofx, ofy) === true && cvsStyle.cursor === '') {
      cvsStyle.cursor = 'move';
    }
  };
  const onWindowUp = (): void => {
    isMSDown = false;
  };

  // 八个 ctrl 点位对应的鼠标样式，构成循环
  const curStyles = [
    'ns-resize',
    'nesw-resize',
    'ew-resize',
    'nwse-resize',
    'ns-resize',
    'nesw-resize',
    'ew-resize',
    'nwse-resize',
  ];
  const curInitIdx = { t: 0, rt: 1, r: 2, rb: 3, b: 4, lb: 5, l: 6, lt: 7 };

  const onMove = (evt: MouseEvent): void => {
    // 按下之后，不再变化，因为可能是在拖拽控制点
    if (actSpr == null || isMSDown) return;
    const { offsetX, offsetY } = evt;
    const ofx = offsetX / cvsRatio.w;
    const ofy = offsetY / cvsRatio.h;
    const [ctrlKey] =
      (Object.entries(actSpr.rect.ctrls).find(([, rect]) =>
        rect.checkHit(ofx, ofy)
      ) as [TCtrlKey, Rect]) ?? [];

    if (ctrlKey != null) {
      if (ctrlKey === 'rotate') {
        cvsStyle.cursor = 'crosshair';
        return;
      }
      // 旋转后，控制点的箭头指向也需要修正
      const angle = actSpr.rect.angle;
      const oa = angle < 0 ? angle + 2 * Math.PI : angle;
      // 每个控制点的初始样式（idx） + 旋转角度导致的偏移，即为新鼠标样式
      // 每旋转45°，偏移+1，以此在curStyles中循环
      const idx =
        (curInitIdx[ctrlKey] + Math.floor((oa + Math.PI / 8) / (Math.PI / 4))) %
        8;
      cvsStyle.cursor = curStyles[idx];
      return;
    }
    if (actSpr.rect.checkHit(ofx, ofy)) {
      cvsStyle.cursor = 'move';
      return;
    }
    // 未命中 ctrls、sprite，重置为默认鼠标样式
    cvsStyle.cursor = '';
  };

  cvsEl.addEventListener('mousemove', onMove);
  cvsEl.addEventListener('mousedown', onDown);
  window.addEventListener('mouseup', onWindowUp);

  return () => {
    observer.disconnect();
    cvsEl.removeEventListener('mousemove', onMove);
    cvsEl.removeEventListener('mousedown', onDown);
    window.removeEventListener('mouseup', onWindowUp);
  };
}
