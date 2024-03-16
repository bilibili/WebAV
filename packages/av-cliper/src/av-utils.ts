// 能同时在 worker 和主线程中运行的工具函数

import { Log } from './log';
import { workerTimer } from './worker-timer';
import { resample } from 'wave-resampler';

/**
 * 合并（串联）多个 Float32Array，通常用于合并 PCM 数据
 */
export function concatFloat32Array(bufs: Float32Array[]): Float32Array {
  const rs = new Float32Array(
    bufs.map((buf) => buf.length).reduce((a, b) => a + b),
  );

  let offset = 0;
  for (const buf of bufs) {
    rs.set(buf, offset);
    offset += buf.length;
  }

  return rs;
}

/**
 * 将小片段的 PCM 合并成一个大片段
 * @param fragments 小片段 PCM，子元素是不同声道的原始 PCM 数据
 */
export function concatPCMFragments(
  fragments: Float32Array[][],
): Float32Array[] {
  // fragments: [[chan0, chan1], [chan0, chan1]...]
  // chanListPCM: [[chan0, chan0...], [chan1, chan1...]]
  const chanListPCM: Float32Array[][] = [];
  for (let i = 0; i < fragments.length; i += 1) {
    for (let j = 0; j < fragments[i].length; j += 1) {
      if (chanListPCM[j] == null) chanListPCM[j] = [];
      chanListPCM[j].push(fragments[i][j]);
    }
  }
  // [bigChan0, bigChan1]
  return chanListPCM.map(concatFloat32Array);
}

/**
 * 从 AudioData 中提取 PCM 数据
 */
export function extractPCM4AudioData(ad: AudioData): Float32Array[] {
  return Array(ad.numberOfChannels)
    .fill(0)
    .map((_, idx) => {
      const chanBufSize = ad.allocationSize({ planeIndex: idx });
      const chanBuf = new ArrayBuffer(chanBufSize);
      ad.copyTo(chanBuf, { planeIndex: idx });
      return new Float32Array(chanBuf);
    });
}

/**
 * 从 AudioBuffer 中提取 PCM
 */
export function extractPCM4AudioBuffer(ab: AudioBuffer): Float32Array[] {
  return Array(ab.numberOfChannels)
    .fill(0)
    .map((_, idx) => {
      return ab.getChannelData(idx);
    });
}

export function adjustAudioDataVolume(ad: AudioData, volume: number) {
  const data = new Float32Array(
    concatFloat32Array(extractPCM4AudioData(ad)),
  ).map((v) => v * volume);
  const newAd = new AudioData({
    sampleRate: ad.sampleRate,
    numberOfChannels: ad.numberOfChannels,
    timestamp: ad.timestamp,
    format: ad.format,
    numberOfFrames: ad.numberOfFrames,
    data,
  });
  ad.close();
  return newAd;
}

export async function decodeImg(
  stream: ReadableStream<Uint8Array>,
  type: string,
): Promise<VideoFrame[]> {
  const init = {
    type,
    data: stream,
  };
  const imageDecoder = new ImageDecoder(init);
  await imageDecoder.completed;

  let frameCnt = imageDecoder.tracks.selectedTrack?.frameCount ?? 1;

  const rs: VideoFrame[] = [];
  for (let i = 0; i < frameCnt; i += 1) {
    rs.push((await imageDecoder.decode({ frameIndex: i })).image);
  }
  return rs;
}

/**
 * 混合双通道音轨的 PCM 数据，并将多声道并排成一个 Float32Array 输出
 * 如果只传入一个音轨[Float32Array[]]，返回结果是将这个一个音轨的左右声道并排成 Float32Array
 */
export function mixinPCM(audios: Float32Array[][]): Float32Array {
  const maxLen = Math.max(...audios.map((a) => a[0]?.length ?? 0));
  const data = new Float32Array(maxLen * 2);

  for (let bufIdx = 0; bufIdx < maxLen; bufIdx++) {
    let chan0 = 0;
    let chan1 = 0;
    for (let trackIdx = 0; trackIdx < audios.length; trackIdx++) {
      const _c0 = audios[trackIdx][0]?.[bufIdx] ?? 0;
      // 如果是单声道 PCM，第二声道复用第一声道数据
      const _c1 = audios[trackIdx][1]?.[bufIdx] ?? _c0;
      chan0 += _c0;
      chan1 += _c1;
    }
    data[bufIdx] = chan0;
    data[bufIdx + maxLen] = chan1;
  }

  return data;
}

/**
 * 音频 PCM 重采样
 * @param pcmData PCM
 * @param curRate 当前采样率
 * @param target { rate: 目标采样率, chanCount: 目标声道数 }
 * @returns PCM
 */
export async function audioResample(
  pcmData: Float32Array[],
  curRate: number,
  target: {
    rate: number;
    chanCount: number;
  },
): Promise<Float32Array[]> {
  const chanCnt = pcmData.length;
  const emptyPCM = Array(target.chanCount)
    .fill(0)
    .map(() => new Float32Array(0));
  if (chanCnt === 0) return emptyPCM;

  const len = Math.max(...pcmData.map((c) => c.length));
  if (len === 0) return emptyPCM;

  // The Worker scope does not have access to OfflineAudioContext
  if (globalThis.OfflineAudioContext == null) {
    return pcmData.map(
      (p) =>
        new Float32Array(
          resample(p, curRate, target.rate, { method: 'sinc', LPF: false }),
        ),
    );
  }

  const ctx = new globalThis.OfflineAudioContext(
    target.chanCount,
    (len * target.rate) / curRate,
    target.rate,
  );
  const abSource = ctx.createBufferSource();
  const ab = ctx.createBuffer(chanCnt, len, curRate);
  pcmData.forEach((d, idx) => ab.copyToChannel(d, idx));

  abSource.buffer = ab;
  abSource.connect(ctx.destination);
  abSource.start();

  return extractPCM4AudioBuffer(await ctx.startRendering());
}

export function sleep(time: number): Promise<void> {
  return new Promise((resolve) => {
    const stop = workerTimer(() => {
      stop();
      resolve();
    }, time);
  });
}

/**
 *  循环 即 环形取值，主要用于截取 PCM
 */
export function ringSliceFloat32Array(
  data: Float32Array,
  start: number,
  end: number,
): Float32Array {
  const cnt = end - start;
  const rs = new Float32Array(cnt);
  let i = 0;
  while (i < cnt) {
    rs[i] = data[(start + i) % data.length];
    i += 1;
  }
  return rs;
}

export function autoReadStream<ST extends ReadableStream>(
  stream: ST,
  cbs: {
    onChunk: ST extends ReadableStream<infer DT>
      ? (chunk: DT) => Promise<void>
      : never;
    onDone: () => void;
  },
) {
  let stoped = false;
  async function run() {
    const reader = stream.getReader();

    while (!stoped) {
      const { value, done } = await reader.read();
      if (done) {
        cbs.onDone();
        return;
      }
      await cbs.onChunk(value);
    }

    reader.releaseLock();
    await stream.cancel();
  }

  run().catch(Log.error);

  return () => {
    stoped = true;
  };
}

/**
 * 函数节流
 */
export function throttle<F extends (...args: any[]) => any>(
  func: F,
  wait: number,
): (...rest: Parameters<F>) => undefined | ReturnType<F> {
  let lastTime: number;
  return function (this: any, ...rest) {
    if (lastTime == null || performance.now() - lastTime > wait) {
      lastTime = performance.now();
      return func.apply(this, rest);
    }
  };
}

// 封装 decoder，一次解析一个 GOP
export function createGoPVideoDecoder(conf: VideoDecoderConfig) {
  type OutputHandle = (vf: VideoFrame | null, done: boolean) => void;

  let curCb: ((vf: VideoFrame) => void) | null = null;
  const vdec = new VideoDecoder({
    output: (vf) => {
      curCb?.(vf);
    },
    error: Log.error,
  });
  vdec.configure(conf);

  let tasks: Array<{
    chunks: EncodedVideoChunk[];
    cb: (vf: VideoFrame | null, done: boolean) => void;
  }> = [];

  async function run() {
    if (curCb != null) return;

    const t = tasks.shift();
    if (t == null) return;
    let i = 0;
    curCb = (vf) => {
      i += 1;
      const done = i >= t.chunks.length;
      t.cb(vf, done);
      if (done) {
        curCb = null;
        run().catch(Log.error);
      }
    };
    if (t.chunks.length <= 0) {
      t.cb(null, true);
      curCb = null;
      run().catch(Log.error);
      return;
    }
    for (const chunk of t.chunks) vdec.decode(chunk);
    await vdec.flush();
  }

  return {
    decode(chunks: EncodedVideoChunk[], cb: OutputHandle) {
      tasks.push({ chunks, cb });
      run().catch(Log.error);
    },
  };
}
