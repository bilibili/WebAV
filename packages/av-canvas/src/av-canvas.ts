import {
  workerTimer,
  mixinPCM,
  Log,
  Rect,
  TCtrlKey,
  EventTool,
  Combinator,
  OffscreenSprite,
  VisibleSprite,
  MediaStreamClip,
  DEFAULT_AUDIO_CONF,
  concatPCMFragments,
  concatFloat32Array,
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
    display: block;
  `;
  cvsEl.width = resolution.width;
  cvsEl.height = resolution.height;

  return cvsEl;
}

/**
 *
 * 可在浏览器环境中快速实现视频剪辑功能，且非常容易集成的直播推流工作台中。
 * @description
 * 支持用户添加各种素材，并拖动改变它们的位置：
  - 添加/删除素材（视频、音频、图片、文字）
  - 分割（裁剪）素材
  - 控制素材在视频中的空间属性（坐标、旋转、缩放）
  - 控制素材在视频中的时间属性（偏移、时长）
  - 实时预览播放
  - 纯浏览器环境生成视频
 * @see [直播录制](https://bilibili.github.io/WebAV/demo/4_2-recorder-avcanvas)
 * @see [视频剪辑](https://bilibili.github.io/WebAV/demo/6_4-video-editor)
 * @example
 *
const avCvs = new AVCanvas(document.querySelector('#app'), {
    bgColor: '#333',
    width: 1920,
    height: 1080,
});
 *
 */
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
    activeSpriteChange: (sprite: VisibleSprite | null) => void;
  }>();
  on = this.#evtTool.on;

  #opts;

  /**
   * 创建 `AVCanvas` 类的实例。
   * @param attchEl - 要添加画布的元素。
   * @param opts - 画布的选项
   * @param opts.bgColor - 画布的背景颜色。
   * @param opts.width - 画布的宽度。
   * @param opts.height - 画布的高度。
   */
  constructor(
    attchEl: HTMLElement,
    opts: {
      bgColor: string;
    } & IResolution,
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

    // createEmptyOscillatorNode(this.#audioCtx).connect(this.#captureAudioDest);

    Rect.CTRL_SIZE = 12 / (900 / this.#cvsEl.width);
    this.#spriteManager = new SpriteManager();

    this.#clears.push(
      // 鼠标样式、控制 sprite 依赖 activeSprite，
      // activeSprite 需要在他们之前监听到 mousedown 事件 (代码顺序需要靠前)
      activeSprite(this.#cvsEl, this.#spriteManager),
      dynamicCusor(this.#cvsEl, this.#spriteManager),
      draggabelSprite(this.#cvsEl, this.#spriteManager, container),
      renderCtrls(container, this.#cvsEl, this.#spriteManager),
      this.#spriteManager.on(ESpriteManagerEvt.AddSprite, (s) => {
        const { rect } = s;
        // 默认居中
        if (rect.x === 0 && rect.y === 0) {
          rect.x = (this.#cvsEl.width - rect.w) / 2;
          rect.y = (this.#cvsEl.height - rect.h) / 2;
        }
      }),
      EventTool.forwardEvent(this.#spriteManager, this.#evtTool, [
        ESpriteManagerEvt.ActiveSpriteChange,
      ]),
    );

    let lastRenderTime = this.#renderTime;
    let start = performance.now();
    let runCnt = 0;
    const expectFrameTime = 1000 / 30;
    this.#stopRender = workerTimer(() => {
      // workerTimer 会略快于真实时钟，使用真实时间（performance.now）作为基准
      // 跳过部分运行帧修正时间，避免导致音画不同步
      if ((performance.now() - start) / (expectFrameTime * runCnt) < 1) {
        return;
      }
      runCnt += 1;
      this.#cvsCtx.fillStyle = opts.bgColor;
      this.#cvsCtx.fillRect(0, 0, this.#cvsEl.width, this.#cvsEl.height);
      this.#render();

      if (lastRenderTime !== this.#renderTime) {
        lastRenderTime = this.#renderTime;
        this.#evtTool.emit('timeupdate', Math.round(lastRenderTime));
      }
    }, expectFrameTime);

    // ;(window as any).cvsEl = this.#cvsEl
  }

  #renderTime = 0e6;
  #updateRenderTime(time: number) {
    this.#renderTime = time;
    this.#spriteManager.updateRenderTime(time);
  }

  #pause() {
    const emitPaused = this.#playState.step !== 0;
    this.#playState.step = 0;
    if (emitPaused) {
      this.#evtTool.emit('paused');
      this.#audioCtx.suspend();
    }
    for (const asn of this.#playingAudioCache) {
      asn.stop();
      asn.disconnect();
    }
    this.#playingAudioCache.clear();
  }

  #audioCtx = new AudioContext();
  // #captureAudioDest = this.#audioCtx.createMediaStreamDestination();
  #captureAudioDest = createAudioTrackGen();

  #playingAudioCache: Set<AudioBufferSourceNode> = new Set();
  #render() {
    const cvsCtx = this.#cvsCtx;
    let ts = this.#renderTime;
    const { start, end, step, audioPlayAt } = this.#playState;
    if (step !== 0 && ts >= start && ts < end) {
      ts += step;
    } else {
      this.#pause();
    }
    this.#updateRenderTime(ts);

    const ctxDestAudioData: Float32Array[][] = [];
    // 已经渲染的声音则不需要输出到 AudioContext.destination 再次渲染
    const renderedAudioData: Float32Array[][] = [];
    for (const s of this.#spriteManager.getSprites()) {
      cvsCtx.save();
      const { audio } = s.render(cvsCtx, ts - s.time.offset);
      cvsCtx.restore();

      const clip = s.getClip();
      if (clip instanceof MediaStreamClip && clip.meta.isRenderedToSpeaker) {
        renderedAudioData.push(audio);
      } else {
        ctxDestAudioData.push(audio);
      }
    }
    cvsCtx.resetTransform();

    if (step !== 0) {
      const curAudioTime = Math.max(this.#audioCtx.currentTime, audioPlayAt);
      const ctxDestADSource = convertPCM2AudioSource(
        ctxDestAudioData,
        this.#audioCtx,
      );
      if (ctxDestADSource != null) {
        ctxDestADSource.start(curAudioTime);
        ctxDestADSource.connect(this.#audioCtx.destination);

        this.#playingAudioCache.add(ctxDestADSource);
        ctxDestADSource.onended = () => {
          ctxDestADSource.disconnect();
          this.#playingAudioCache.delete(ctxDestADSource);
        };
        this.#playState.audioPlayAt =
          curAudioTime + (ctxDestADSource.buffer?.duration ?? 0);
      }
      // const renderedADSource = convertPCM2AudioSource(
      //   renderedAudioData,
      //   this.#audioCtx,
      // );
      // if (renderedADSource != null) {
      //   ctxDestADSource?.connect(this.#captureAudioDest);

      //   renderedADSource.start(curAudioTime);
      //   renderedADSource.connect(this.#captureAudioDest);
      //   renderedADSource.onended = () => {
      //     ctxDestADSource?.disconnect();
      //   };
      // }
      this.#captureAudioDest.write([...ctxDestAudioData, ...renderedAudioData]);
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
  /**
   * 每 33ms 更新一次画布，绘制已添加的 Sprite
   * @param opts - 播放选项
   * @param opts.start - 开始播放的时间（单位：微秒）
   * @param [opts.end] - 结束播放的时间（单位：微秒）。如果未指定，则播放到最后一个 Sprite 的结束时间
   * @param [opts.playbackRate] - 播放速率。1 表示正常速度，2 表示两倍速度，0.5 表示半速等。如果未指定，则默认为 1
   * @throws 如果开始时间大于等于结束时间或小于 0，则抛出错误
   */
  play(opts: { start: number; end?: number; playbackRate?: number }) {
    const spriteTimes = this.#spriteManager
      .getSprites({ time: false })
      .map((s) => s.time.offset + s.time.duration);
    const end =
      opts.end ??
      (spriteTimes.length > 0 ? Math.max(...spriteTimes) : Infinity);

    if (opts.start >= end || opts.start < 0) {
      throw Error(
        `Invalid time parameter, ${JSON.stringify({ start: opts.start, end })}`,
      );
    }

    this.#updateRenderTime(opts.start);
    this.#spriteManager
      .getSprites({ time: false })
      .forEach((vs) => vs.preFirstFrame());

    this.#playState.start = opts.start;
    this.#playState.end = end;
    // AVCanvas 30FPS，将播放速率转换成步长
    this.#playState.step = (opts.playbackRate ?? 1) * (1000 / 30) * 1000;
    this.#audioCtx.resume();
    this.#playState.audioPlayAt = 0;

    this.#evtTool.emit('playing');
    Log.info('AVCanvs play by:', this.#playState);
  }

  /**
   * 暂停播放，画布内容不再更新
   */
  pause() {
    this.#pause();
  }

  /**
   * 预览 `AVCanvas` 指定时间的图像帧
   */
  previewFrame(time: number) {
    this.#updateRenderTime(time);
    this.#pause();
  }

  // proxy to SpriteManager
  addSprite: SpriteManager['addSprite'] = (...args) =>
    this.#spriteManager.addSprite(...args);
  removeSprite: SpriteManager['removeSprite'] = (...args) =>
    this.#spriteManager.removeSprite(...args);

  /**
   * 销毁实例
   */
  destroy(): void {
    if (this.#destroyed) return;
    this.#destroyed = true;

    this.#audioCtx.close();
    // this.#captureAudioDest.disconnect();
    this.#captureAudioDest.destroy();
    this.#evtTool.destroy();
    this.#stopRender();
    this.#cvsEl.parentElement?.remove();
    this.#clears.forEach((fn) => fn());
    this.#playingAudioCache.clear();
    this.#spriteManager.destroy();
  }

  /**
   * 合成所有素材的图像与音频，返回 `MediaStream` 可用于 WebRTC 推流，或由 AVRecorder 录制生成视频文件
   * @returns- {@link MediaStream}
   */
  captureStream(): MediaStream {
    if (this.#audioCtx.state === 'suspended') {
      this.#audioCtx.resume().catch(Log.error);
    }

    const ms = new MediaStream(
      this.#cvsEl
        .captureStream()
        .getTracks()
        .concat(this.#captureAudioDest.getTrack()),
      // .concat(this.#captureAudioDest.stream.getTracks()),
    );
    Log.info(
      'AVCanvas.captureStream, tracks:',
      ms.getTracks().map((t) => t.kind),
    );
    return ms;
  }

  /**
   * 创建视频合成器 {@link Combinator}
   * @param opts - 创建 Combinator 的可选参数
   * @throws 如果没有添加素材，会抛出错误
   */
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

function convertPCM2AudioSource(pcmData: Float32Array[][], ctx: AudioContext) {
  if (pcmData.length === 0) return null;
  const [chan0, chan1] = concatPCMFragments(pcmData);
  if (chan0 == null || chan0.length === 0) return null;
  const buf = ctx.createBuffer(
    2,
    chan0.length / 2,
    DEFAULT_AUDIO_CONF.sampleRate,
  );
  console.log(5555555, chan0.length / 48000);
  buf.copyToChannel(chan0, 0);
  buf.copyToChannel(chan1, 1);
  const audioSource = ctx.createBufferSource();
  audioSource.buffer = buf;
  return audioSource;
}

/**
 * 根据当前位置（sprite & ctrls），动态调整鼠标样式
 */
function dynamicCusor(
  cvsEl: HTMLCanvasElement,
  sprMng: SpriteManager,
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
        rect.checkHit(ofx, ofy),
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

/**
 * 空背景音，让 dest 能持续收到音频数据，否则时间会异常偏移
 */
function createEmptyOscillatorNode(ctx: AudioContext) {
  const osc = ctx.createOscillator();
  const real = new Float32Array([0, 0]);
  const imag = new Float32Array([0, 0]);
  const wave = ctx.createPeriodicWave(real, imag, {
    disableNormalization: true,
  });
  osc.setPeriodicWave(wave);
  osc.start();
  return osc;
}

function createAudioTrackGen() {
  const gen = new MediaStreamTrackGenerator({ kind: 'audio' });
  const adWriter = gen.writable.getWriter();
  let audioDataPool: [Float32Array, Float32Array] = [
    new Float32Array(0),
    new Float32Array(0),
  ];
  let lastTime = performance.now();
  const sampleRate = DEFAULT_AUDIO_CONF.sampleRate;

  const stopTimer = workerTimer(() => {
    const now = performance.now();
    const numberOfFrames = Math.round(((now - lastTime) / 1000) * sampleRate);
    if (numberOfFrames <= 0) return;

    // console.log(111112333, numberOfFrames, audioDataPool[0].length);
    const adData = mixinPCM([
      [new Float32Array(numberOfFrames), new Float32Array(numberOfFrames)],
      audioDataPool.map((d) => d.slice(0, numberOfFrames)),
    ]);
    audioDataPool = audioDataPool.map((d) => d.slice(numberOfFrames)) as [
      Float32Array,
      Float32Array,
    ];

    // console.log(3333, numberOfFrames, adData.length);
    // adWriter.write(
    //   new AudioData({
    //     numberOfChannels: 2,
    //     sampleRate,
    //     numberOfFrames,
    //     timestamp: lastTime * 1000,
    //     format: 'f32-planar',
    //     data: adData,
    //   }),
    // );
    lastTime = now;
  }, 1000 / 30);
  return {
    write: (pcm: Float32Array[][]) => {
      if (pcm.length === 0) return;
      console.log(
        1111,
        pcm.map((p) => p[0]?.length),
      );
      const adData = mixinPCM(pcm);
      if (adData.length === 0) return;
      const numberOfFrames = adData.length / 2;
      adWriter.write(
        new AudioData({
          numberOfChannels: 2,
          sampleRate,
          numberOfFrames,
          timestamp: lastTime * 1000,
          format: 'f32-planar',
          data: adData,
        }),
      );

      // const mergedByChan = concatPCMFragments(pcm);
      // if (mergedByChan.length === 0) return;

      // audioDataPool[0] = concatFloat32Array([
      //   audioDataPool[0],
      //   mergedByChan[0],
      // ]);
      // audioDataPool[1] = concatFloat32Array([
      //   audioDataPool[1],
      //   mergedByChan[1] ?? mergedByChan[0],
      // ]);
    },
    getTrack: () => gen as MediaStreamAudioTrack,
    destroy: () => {
      stopTimer();
    },
  };
}
