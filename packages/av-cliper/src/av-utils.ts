// 能同时在 worker 和主线程中运行的工具函数

import { workerTimer } from '@webav/internal-utils';
import * as waveResampler from 'wave-resampler';

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
 * 从 AudioData 中提取 PCM 数据的工具函数
 */
export function extractPCM4AudioData(ad: AudioData): Float32Array[] {
  if (ad.format === 'f32-planar') {
    const rs = [];
    for (let idx = 0; idx < ad.numberOfChannels; idx += 1) {
      const chanBufSize = ad.allocationSize({ planeIndex: idx });
      const chanBuf = new ArrayBuffer(chanBufSize);
      ad.copyTo(chanBuf, { planeIndex: idx });
      rs.push(new Float32Array(chanBuf));
    }
    return rs;
  } else if (ad.format === 'f32') {
    const buf = new ArrayBuffer(ad.allocationSize({ planeIndex: 0 }));
    ad.copyTo(buf, { planeIndex: 0 });
    return convertF32ToPlanar(new Float32Array(buf), ad.numberOfChannels);
  } else if (ad.format === 's16') {
    const buf = new ArrayBuffer(ad.allocationSize({ planeIndex: 0 }));
    ad.copyTo(buf, { planeIndex: 0 });
    return convertS16ToF32Planar(new Int16Array(buf), ad.numberOfChannels);
  }
  throw Error('Unsupported audio data format');
}

/**
 * Convert s16 PCM to f32-planar
 * @param  pcmS16Data - The s16 PCM data.
 * @param  numChannels - Number of audio channels.
 * @returns An array of Float32Array, each containing the audio data for one channel.
 */
function convertS16ToF32Planar(pcmS16Data: Int16Array, numChannels: number) {
  const numSamples = pcmS16Data.length / numChannels;
  const planarData = Array.from(
    { length: numChannels },
    () => new Float32Array(numSamples),
  );

  for (let i = 0; i < numSamples; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      const sample = pcmS16Data[i * numChannels + channel];
      planarData[channel][i] = sample / 32768; // Normalize to range [-1.0, 1.0]
    }
  }

  return planarData;
}

function convertF32ToPlanar(pcmF32Data: Float32Array, numChannels: number) {
  const numSamples = pcmF32Data.length / numChannels;
  const planarData = Array.from(
    { length: numChannels },
    () => new Float32Array(numSamples),
  );

  for (let i = 0; i < numSamples; i++) {
    for (let channel = 0; channel < numChannels; channel++) {
      planarData[channel][i] = pcmF32Data[i * numChannels + channel];
    }
  }

  return planarData;
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

/**
 * 调整音频数据的音量
 * @param ad - 要调整的音频对象
 * @param volume - 音量调整系数（0.0 - 1.0）
 * @returns 调整音量后的新音频数据
 */
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

/**
 * 解码图像流，返回一个视频帧数组。
 *
 * @param stream - 包含图像数据的可读流。
 * @param type - 图像的 MIME 类型，例如 'image/jpeg'。
 *
 * @returns 返回一个 Promise，该 Promise 在解码完成后解析为 {@link VideoFrame} 数组。
 *
 * @see [解码动图](https://bilibili.github.io/WebAV/demo/1_3-decode-image)
 *
 * @example
 *
 * const frames = await decodeImg(
 *   (await fetch('<gif url>')).body!,
 *   `image/gif`,
 * );
 */
export async function decodeImg(
  stream: ReadableStream<Uint8Array>,
  type: string,
): Promise<VideoFrame[]> {
  const init = {
    type,
    data: stream,
  };
  const imageDecoder = new ImageDecoder(init);

  await Promise.all([imageDecoder.completed, imageDecoder.tracks.ready]);

  let frameCnt = imageDecoder.tracks.selectedTrack?.frameCount ?? 1;

  const rs: VideoFrame[] = [];
  for (let i = 0; i < frameCnt; i += 1) {
    rs.push((await imageDecoder.decode({ frameIndex: i })).image);
  }
  return rs;
}

/**
 * 混合双通道音轨的 PCM 数据，并将多声道并排成一个 Float32Array 输出
 * @param audios - 一个二维数组，每个元素是一个 Float32Array 数组，代表一个音频流的 PCM 数据。
 * 每个 Float32Array 数组的第一个元素是左声道数据，第二个元素（如果有）是右声道数据。
 * 如果只有左声道数据，则右声道将复用左声道数据。
 *
 * @returns 返回一个 Float32Array，返回结果是将这个一个音轨的左右声道并排成 Float32Array。
 *
 * @example
 *
 * const audios = [
 *   [new Float32Array([0.1, 0.2, 0.3]), new Float32Array([0.4, 0.5, 0.6])],
 *   [new Float32Array([0.7, 0.8, 0.9])],
 * ];
 * const mixed = mixinPCM(audios);
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
 * 对 PCM 音频数据进行重采样。
 *
 * @param pcmData - 一个 Float32Array 数组，每个元素代表一个声道的 PCM 数据。
 * @param curRate - 当前的采样率。
 * @param target - 目标参数对象。
 * @param target.rate - 目标采样率。
 * @param target.chanCount - 目标声道数。
 *
 * @returns 返回一个 Promise，该 Promise 在重采样完成后解析为一个 Float32Array 数组，每个元素代表一个声道的 PCM 数据。
 *
 * @example
 *
 * const pcmData = [new Float32Array([0.1, 0.2, 0.3]), new Float32Array([0.4, 0.5, 0.6])];
 * const curRate = 44100;
 * const target = { rate: 48000, chanCount: 2 };
 * const resampled = await audioResample(pcmData, curRate, target);
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
          waveResampler.resample(p, curRate, target.rate, {
            method: 'sinc',
            LPF: false,
          }),
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

/**
 * 使当前执行环境暂停一段时间。
 * @param time - 暂停的时间，单位为毫秒。
 * @example
 * await sleep(1000);  // 暂停 1 秒
 */
export function sleep(time: number): Promise<void> {
  return new Promise((resolve) => {
    const stop = workerTimer(() => {
      stop();
      resolve();
    }, time);
  });
}

/**
 * 从给定的 Float32Array 中提取一个环形切片，超出边界从 0 开始循环
 *
 * 主要用于截取 PCM 实现循环播放
 *
 * @param data - 输入的 Float32Array。
 * @param start - 切片的开始索引。
 * @param end - 切片的结束索引。
 * @returns - 返回一个新的 Float32Array，包含从 start 到 end 的数据。
 *
 * @example
 * const data = new Float32Array([0, 1, 2, 3, 4, 5]);
 * ringSliceFloat32Array(data, 4, 6); // => Float32Array [4, 5, 0]
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

/**
 * 改变 PCM 数据的播放速率，1 表示正常播放，0.5 表示播放速率减半，2 表示播放速率加倍
 */
export function changePCMPlaybackRate(
  pcmData: Float32Array,
  playbackRate: number,
) {
  // 计算新的采样率
  const newLength = Math.floor(pcmData.length / playbackRate);
  const newPcmData = new Float32Array(newLength);

  // 线性插值
  for (let i = 0; i < newLength; i++) {
    // 原始数据中的位置
    const originalIndex = i * playbackRate;
    const intIndex = Math.floor(originalIndex);
    const frac = originalIndex - intIndex;

    // 边界检查
    if (intIndex + 1 < pcmData.length) {
      newPcmData[i] =
        pcmData[intIndex] * (1 - frac) + pcmData[intIndex + 1] * frac;
    } else {
      newPcmData[i] = pcmData[intIndex]; // 最后一个样本
    }
  }

  return newPcmData;
}
