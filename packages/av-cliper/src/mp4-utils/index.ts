import mp4box, {
  MP4ArrayBuffer,
  MP4File,
  MP4Sample,
  SampleOpts,
  TrakBoxParser,
} from '@webav/mp4box.js';
import { Log } from '../log';
import {
  autoReadStream,
  extractPCM4AudioData,
  extractPCM4AudioBuffer,
  mixinPCM,
  ringSliceFloat32Array,
  concatPCMFragments,
} from '../av-utils';
import { DEFAULT_AUDIO_CONF } from '../clips';
import { EventTool } from '../event-tool';
import { SampleTransform } from './sample-transform';
import { extractFileConfig, unsafeReleaseMP4BoxFile } from './mp4box-utils';
import { tmpfile, write } from 'opfs-tools';

type TCleanFn = () => void;

/**
 * 定义 recodemux 函数的配置选项。
 * @interface
 * @property video - 视频配置选项，如果为 null 则不处理视频。
 * @property video.width - 视频的宽度。
 * @property video.height - 视频的高度。
 * @property video.expectFPS - 期望的帧率。
 * @property video.codec - 视频编码格式。
 * @property video.bitrate - 视频比特率。
 * @property audio - 音频配置选项，如果为 null 则不处理音频。
 * @property audio.codec - 音频编码格式。
 * @property audio.sampleRate - 音频采样率。
 * @property audio.channelCount - 音频通道数。
 */
interface IRecodeMuxOpts {
  video: {
    width: number;
    height: number;
    expectFPS: number;
    codec: string;
    bitrate: number;
  } | null;
  audio: {
    codec: 'opus' | 'aac';
    sampleRate: number;
    channelCount: number;
  } | null;
}

const createBoxHeader = (type: string, size: number): Uint8Array => {
  const buffer = new Uint8Array(8);
  const view = new DataView(buffer.buffer);
  view.setUint32(0, size); // Write size as a 32-bit unsigned integer
  for (let i = 0; i < 4; i++) {
    buffer[4 + i] = type.charCodeAt(i); // Write type as a 4-character string
  }
  return buffer;
};

const createHdlrBox = (): Uint8Array => {
  const tec = new TextEncoder();
  const handlerType = tec.encode('mdta');
  const nameBytes = tec.encode('mp4 handler');
  // header8 + ?8 + mdta4 + ?12 + nameSize + endFlag1
  const size = 8 + 8 + 4 + 12 + nameBytes.byteLength + 1;
  const buffer = new Uint8Array(size);
  const view = new DataView(buffer.buffer);

  // Box header
  buffer.set(createBoxHeader('hdlr', size), 0);

  // Full box header (version and flags)
  view.setUint32(8, 0);

  buffer.set(handlerType, 16);
  buffer.set(nameBytes, 32);

  return buffer;
};

const createKeysBox = (keys: string[]): Uint8Array => {
  const tec = new TextEncoder();
  const mdtaBuf = tec.encode('mdta');
  const keyData = keys.map((key) => {
    const keyBuf = tec.encode(key);
    // size4 + mdta4 + keyBuf
    const size = 4 + mdtaBuf.byteLength + keyBuf.byteLength;

    const entryBuf = new Uint8Array(size);
    const dv = new DataView(entryBuf.buffer);
    dv.setUint32(0, size);
    entryBuf.set(mdtaBuf, 4);
    entryBuf.set(keyBuf, 4 + mdtaBuf.byteLength);

    return entryBuf;
  });
  const keyDataSize = keyData.reduce((acc, cur) => acc + cur.byteLength, 0);

  const size = 16 + keyDataSize; // 16 bytes for the header and version/flags
  const buffer = new Uint8Array(size);
  const view = new DataView(buffer.buffer);

  // Box header
  buffer.set(createBoxHeader('keys', size), 0);

  // Full box header (version and flags)
  view.setUint32(8, 0);
  view.setUint32(12, keys.length); // Entry count

  // Keys
  let offset = 16;
  keyData.forEach((keyBuf) => {
    buffer.set(keyBuf, offset);
    offset += keyBuf.byteLength;
  });

  return buffer;
};

const createIlstBox = (data: Record<string, string>): Uint8Array => {
  const tec = new TextEncoder();
  const dataStrBuf = tec.encode('data');
  const valueData = Object.entries(data).map(([_, value], index) => {
    const keyId = index + 1; // Assuming keys start from 1
    const valueBytes = tec.encode(value);
    // size4 + keyId4 + valueSize4 + data4 + idx4 + ?4 + value
    const entrySize = 4 + 4 + 4 + 4 + 4 + 4 + valueBytes.byteLength;

    const buffer = new Uint8Array(entrySize);
    const view = new DataView(buffer.buffer);
    view.setUint32(0, entrySize);
    view.setUint32(4, keyId);

    view.setUint32(8, 16 + valueBytes.byteLength);
    buffer.set(dataStrBuf, 12); // 'data' type

    // data idx=1
    view.setUint32(16, 1);
    // Value
    buffer.set(valueBytes, 24);

    return buffer;
  });

  const valueDataSize = valueData.reduce((acc, cur) => acc + cur.byteLength, 0);
  const totalSizwe = 8 + valueDataSize;
  const buffer = new Uint8Array(totalSizwe);
  buffer.set(createBoxHeader('ilst', totalSizwe), 0);

  let offset = 8;
  valueData.forEach((entry) => {
    buffer.set(entry, offset);
    offset += entry.byteLength;
  });

  return buffer;
};

const createMetaBox = (data: Record<string, string>): Uint8Array => {
  const hdlrBox = createHdlrBox();
  const keysBox = createKeysBox(Object.keys(data));
  const ilstBox = createIlstBox(data);

  const size = hdlrBox.length + keysBox.length + ilstBox.length;
  const buffer = new Uint8Array(size);

  // buffer.set(createBoxHeader('meta', size), 0);
  buffer.set(hdlrBox, 0);
  buffer.set(keysBox, hdlrBox.length);
  buffer.set(ilstBox, hdlrBox.length + keysBox.length);

  return buffer;
};

export function recodemux(opts: IRecodeMuxOpts): {
  encodeVideo: (frame: VideoFrame, options?: VideoEncoderEncodeOptions) => void;
  encodeAudio: (data: AudioData) => void;
  close: TCleanFn;
  flush: () => Promise<void>;
  mp4file: MP4File;
  getEecodeQueueSize: () => number;
} {
  Log.info('recodemux opts:', opts);
  const mp4file = mp4box.createFile();

  // 音视频轨道必须同时创建, 保存在 moov 中
  const avSyncEvtTool = new EventTool<
    Record<'VideoReady' | 'AudioReady', () => void>
  >();

  let metaAdded = false;
  const addMetadata = () => {
    if (metaAdded) return;
    metaAdded = true;
    if (mp4file.moov == null) return;

    const udtaBox = mp4file.moov.add('udta');
    const metaBox = udtaBox.add('meta');
    const data = { hello: 'world', foo: 'bar' };
    metaBox.data = createMetaBox(data);
    metaBox.size = metaBox.data.byteLength;
    console.log(222222, metaBox);
  };

  avSyncEvtTool.once('VideoReady', addMetadata);
  avSyncEvtTool.once('AudioReady', addMetadata);

  let vEncoder =
    opts.video != null
      ? encodeVideoTrack(opts.video, mp4file, avSyncEvtTool)
      : null;
  let aEncoder =
    opts.audio != null
      ? encodeAudioTrack(opts.audio, mp4file, avSyncEvtTool)
      : null;
  if (opts.video == null) avSyncEvtTool.emit('VideoReady');
  if (opts.audio == null) avSyncEvtTool.emit('AudioReady');

  return {
    encodeVideo: (vf, opts) => {
      vEncoder?.encode(vf, opts);
      vf.close();
    },
    encodeAudio: (ad) => {
      if (aEncoder == null) return;
      aEncoder.encode(ad);
      ad.close();
    },
    getEecodeQueueSize: () =>
      vEncoder?.encodeQueueSize ?? aEncoder?.encodeQueueSize ?? 0,
    flush: async () => {
      await Promise.all([
        vEncoder?.state === 'configured' ? vEncoder.flush() : null,
        aEncoder?.state === 'configured' ? aEncoder.flush() : null,
      ]);
      return;
    },
    close: () => {
      avSyncEvtTool.destroy();
      if (vEncoder?.state === 'configured') vEncoder.close();
      if (aEncoder?.state === 'configured') aEncoder.close();
    },
    mp4file,
  };
}

function encodeVideoTrack(
  opts: NonNullable<IRecodeMuxOpts['video']>,
  mp4File: MP4File,
  avSyncEvtTool: EventTool<Record<'VideoReady' | 'AudioReady', () => void>>,
): VideoEncoder {
  const videoTrackOpts = {
    // 微秒
    timescale: 1e6,
    width: opts.width,
    height: opts.height,
    brands: ['isom', 'iso2', 'avc1', 'mp42', 'mp41'],
    avcDecoderConfigRecord: null as ArrayBuffer | undefined | null,
    name: 'Track created with WebAV',
  };

  let trackId = -1;
  let cache: EncodedVideoChunk[] = [];
  let audioReady = false;
  avSyncEvtTool.once('AudioReady', () => {
    audioReady = true;
    cache.forEach((c) => {
      const s = chunk2MP4SampleOpts(c);
      mp4File.addSample(trackId, s.data, s);
    });
    cache = [];
  });
  const encoder = createVideoEncoder(opts, (chunk, meta) => {
    if (trackId === -1 && meta != null) {
      videoTrackOpts.avcDecoderConfigRecord = meta.decoderConfig
        ?.description as ArrayBuffer;
      trackId = mp4File.addTrack(videoTrackOpts);
      avSyncEvtTool.emit('VideoReady');
      Log.info('VideoEncoder, video track ready, trackId:', trackId);
    }

    if (audioReady) {
      const s = chunk2MP4SampleOpts(chunk);
      mp4File.addSample(trackId, s.data, s);
    } else {
      cache.push(chunk);
    }
  });

  return encoder;
}

function createVideoEncoder(
  videoOpts: NonNullable<IRecodeMuxOpts['video']>,
  outHandler: EncodedVideoChunkOutputCallback,
): VideoEncoder {
  const encoder = new VideoEncoder({
    error: Log.error,
    output: outHandler,
  });

  encoder.configure({
    codec: videoOpts.codec,
    framerate: videoOpts.expectFPS,
    // hardwareAcceleration: 'prefer-hardware',
    // 码率
    bitrate: videoOpts.bitrate,
    width: videoOpts.width,
    height: videoOpts.height,
    // H264 不支持背景透明度
    alpha: 'discard',
    // macos 自带播放器只支持avc
    avc: { format: 'avc' },
    // mp4box.js 无法解析 annexb 的 mimeCodec ，只会显示 avc1
    // avc: { format: 'annexb' }
  });
  return encoder;
}

function encodeAudioTrack(
  audioOpts: NonNullable<IRecodeMuxOpts['audio']>,
  mp4File: MP4File,
  avSyncEvtTool: EventTool<Record<'VideoReady' | 'AudioReady', () => void>>,
): AudioEncoder {
  const audioTrackOpts = {
    timescale: 1e6,
    samplerate: audioOpts.sampleRate,
    channel_count: audioOpts.channelCount,
    hdlr: 'soun',
    type: audioOpts.codec === 'aac' ? 'mp4a' : 'Opus',
    name: 'Track created with WebAV',
  };

  let trackId = -1;
  let cache: EncodedAudioChunk[] = [];
  let videoReady = false;
  avSyncEvtTool.once('VideoReady', () => {
    videoReady = true;
    cache.forEach((c) => {
      const s = chunk2MP4SampleOpts(c);
      mp4File.addSample(trackId, s.data, s);
    });
    cache = [];
  });

  const encoder = new AudioEncoder({
    error: Log.error,
    output: (chunk, meta) => {
      if (trackId === -1) {
        // 某些设备不会输出 description
        const desc = meta.decoderConfig?.description;
        trackId = mp4File.addTrack({
          ...audioTrackOpts,
          description: desc == null ? undefined : createESDSBox(desc),
        });
        avSyncEvtTool.emit('AudioReady');
        Log.info('AudioEncoder, audio track ready, trackId:', trackId);
      }

      if (videoReady) {
        const s = chunk2MP4SampleOpts(chunk);
        mp4File.addSample(trackId, s.data, s);
      } else {
        cache.push(chunk);
      }
    },
  });
  encoder.configure({
    codec: audioOpts.codec === 'aac' ? DEFAULT_AUDIO_CONF.codec : 'opus',
    sampleRate: audioOpts.sampleRate,
    numberOfChannels: audioOpts.channelCount,
    bitrate: 128_000,
  });

  return encoder;
}

export function _deprecated_stream2file(stream: ReadableStream<Uint8Array>): {
  file: MP4File;
  stop: () => void;
} {
  const reader = stream.getReader();
  let chunkOffset = 0;
  const file = mp4box.createFile();
  let stoped = false;
  async function readFile(): Promise<void> {
    while (!stoped) {
      const { done, value } = await reader.read();
      if (done) {
        Log.info('stream source read done');
        file.flush();
        file.onFlush?.();
        return;
      }

      const chunk = value.buffer as MP4ArrayBuffer;
      chunk.fileStart = chunkOffset;
      chunkOffset += chunk.byteLength;
      file.appendBuffer(chunk);
    }
    reader.releaseLock();
    stream.cancel();
  }
  readFile().catch(Log.error);

  return {
    file,
    stop: () => {
      stoped = true;
    },
  };
}

/**
 * 将 MP4 文件转换为可读流。
 * @param file - MP4 文件实例 {@link MP4File}。
 * @param timeSlice - 时间片，用于控制流的发送速度。
 * @param [onCancel] - 可选的取消回调函数，当流被取消时调用。
 * @returns 返回一个对象，包含以下属性：
 * - stream: 可读流，流的数据是 `Uint8Array` 类型。
 * - stop: 停止函数，可以用于停止流的发送。
 */
export function file2stream(
  file: MP4File,
  timeSlice: number,
  onCancel?: TCleanFn,
): {
  stream: ReadableStream<Uint8Array>;
  stop: (err?: Error) => void;
} {
  let timerId = 0;

  let sendedBoxIdx = 0;
  const boxes = file.boxes;

  const deltaBuf = (): Uint8Array | null => {
    // boxes.length >= 4 表示完成了 ftyp moov，且有了第一个 moof mdat
    // 避免moov未完成时写入文件，导致文件无法被识别
    if (boxes.length < 4 || sendedBoxIdx >= boxes.length) return null;

    const ds = new mp4box.DataStream();
    ds.endianness = mp4box.DataStream.BIG_ENDIAN;

    for (let i = sendedBoxIdx; i < boxes.length; i++) {
      boxes[i].write(ds);
      delete boxes[i];
    }

    unsafeReleaseMP4BoxFile(file);

    sendedBoxIdx = boxes.length;
    return new Uint8Array(ds.buffer);
  };

  let stoped = false;
  let canceled = false;
  let exit: ((err?: Error) => void) | null = null;
  const stream = new ReadableStream({
    start(ctrl) {
      timerId = self.setInterval(() => {
        const d = deltaBuf();
        if (d != null && !canceled) ctrl.enqueue(d);
      }, timeSlice);

      exit = (err) => {
        clearInterval(timerId);
        file.flush();
        if (err != null) {
          ctrl.error(err);
          return;
        }

        const d = deltaBuf();
        if (d != null && !canceled) ctrl.enqueue(d);

        if (!canceled) ctrl.close();
      };

      // 安全起见，检测如果start触发时已经 stoped
      if (stoped) exit();
    },
    cancel() {
      canceled = true;
      clearInterval(timerId);
      onCancel?.();
    },
  });

  return {
    stream,
    stop: (err) => {
      if (stoped) return;
      stoped = true;
      exit?.(err);
    },
  };
}

/**
 * 修复 MP4 文件的 Box 时长
 * @param inMP4File - 输入的 MP4 文件
 * @returns 返回一个函数，该函数返回一个 Promise，解析为一个可读流或 null
 */
function fixMP4BoxFileDuration(
  inMP4File: MP4File,
): () => Promise<ReadableStream<Uint8Array> | null> {
  let sendedBoxIdx = 0;
  const boxes = inMP4File.boxes;
  const tracks: Array<{ track: TrakBoxParser; id: number }> = [];
  let totalDuration = 0;

  /**
   * 将数据写入临时文件
   */
  async function write2TmpFile() {
    const buf = box2Buf(boxes, sendedBoxIdx);
    sendedBoxIdx = boxes.length;
    // 释放引用，避免内存泄露
    // todo: use unsafeReleaseMP4BoxFile
    tracks.forEach(({ track, id }) => {
      const s = track.samples.at(-1);
      if (s != null)
        totalDuration = Math.max(totalDuration, s.cts + s.duration);

      inMP4File.releaseUsedSamples(id, track.samples.length);
      track.samples = [];
    });
    inMP4File.mdats = [];
    inMP4File.moofs = [];
    if (buf != null) await tmpFileWriter?.write(buf);
  }

  let moovPrevBoxes: typeof boxes = [];
  /**
   * 检查 moov box 是否准备好
   * @returns {boolean} 如果 moov box 准备好，返回 `true`，否则返回 `false`
   */
  function moovBoxReady() {
    if (moovPrevBoxes.length > 0) return true;

    const moovIdx = boxes.findIndex((box) => box.type === 'moov');
    if (moovIdx === -1) return false;

    moovPrevBoxes = boxes.slice(0, moovIdx + 1);
    sendedBoxIdx = moovIdx + 1;

    if (tracks.length === 0) {
      for (let i = 1; true; i += 1) {
        const track = inMP4File.getTrackById(i);
        if (track == null) break;
        tracks.push({ track, id: i });
      }
    }

    return true;
  }

  let timerId = 0;
  // 把 moov 之外的 box 先写入临时文件，待更新 duration 之后再拼接临时文件
  const postFile = tmpfile();
  let tmpFileWriter: Awaited<
    ReturnType<ReturnType<typeof tmpfile>['createWriter']>
  > | null = null;

  const initPromise = (async () => {
    tmpFileWriter = await postFile.createWriter();

    timerId = self.setInterval(() => {
      if (!moovBoxReady()) return;
      write2TmpFile();
    }, 100);
  })();

  let stoped = false;
  return async () => {
    if (stoped) throw Error('File exported');
    stoped = true;

    await initPromise;
    clearInterval(timerId);

    if (!moovBoxReady() || tmpFileWriter == null) return null;
    inMP4File.flush();
    await write2TmpFile();
    await tmpFileWriter?.close();

    const moov = moovPrevBoxes.find((box) => box.type === 'moov') as
      | typeof inMP4File.moov
      | undefined;
    if (moov == null) return null;

    moov.mvhd.duration = totalDuration;

    const rsFile = tmpfile();
    const buf = box2Buf(moovPrevBoxes, 0)!;
    await write(rsFile, buf);
    await write(rsFile, postFile, { overwrite: false });

    return await rsFile.stream();
  };

  /**
   * 将 mp4box 转换为 buffer
   * @param source - box 的源数组
   * @param startIdx - 开始的索引
   * @returns 返回一个 Uint8Array 或 null
   */
  function box2Buf(source: typeof boxes, startIdx: number): Uint8Array | null {
    if (startIdx >= source.length) return null;

    const ds = new mp4box.DataStream();
    ds.endianness = mp4box.DataStream.BIG_ENDIAN;

    for (let i = startIdx; i < source.length; i++) {
      if (source[i] === null) continue;
      source[i].write(ds);
      delete source[i];
    }
    return new Uint8Array(ds.buffer);
  }
}

/**
 * EncodedAudioChunk | EncodedVideoChunk 转换为 MP4 addSample 需要的参数
 */
function chunk2MP4SampleOpts(
  chunk: EncodedAudioChunk | EncodedVideoChunk,
): SampleOpts & {
  data: ArrayBuffer;
} {
  const buf = new ArrayBuffer(chunk.byteLength);
  chunk.copyTo(buf);
  const dts = chunk.timestamp;
  return {
    duration: chunk.duration ?? 0,
    dts,
    cts: dts,
    is_sync: chunk.type === 'key',
    data: buf,
  };
}

/**
 * 快速顺序合并多个mp4流，要求所有mp4的属性是一致的。
 * 属性包括（不限于）：音视频编码格式、分辨率、采样率
 *
 * @param streams 一个包含 Uint8Array 的可读流数组。
 * @returns 返回一个 Promise，该 Promise 在解析时返回一个包含合并后的 MP4 数据的可读流。
 * @throws 如果无法从流生成文件，将抛出错误。
 *
 * @example
 * const streams = [stream1, stream2, stream3];
 * const resultStream = await fastConcatMP4(streams);
 */
export async function fastConcatMP4(
  streams: ReadableStream<Uint8Array>[],
): Promise<ReadableStream<Uint8Array>> {
  const outfile = mp4box.createFile();

  const dumpFile = fixMP4BoxFileDuration(outfile);
  await concatStreamsToMP4BoxFile(streams, outfile);
  const outStream = await dumpFile();
  if (outStream == null) throw Error('Can not generate file from streams');
  return outStream;
}

async function concatStreamsToMP4BoxFile(
  streams: ReadableStream<Uint8Array>[],
  outfile: MP4File,
) {
  let vTrackId = 0;
  let vDTS = 0;
  let vCTS = 0;
  let aTrackId = 0;
  let aDTS = 0;
  let aCTS = 0;
  // ts bug, 不能正确识别类型
  let lastVSamp: any = null;
  let lastASamp: any = null;
  for (const stream of streams) {
    await new Promise<void>(async (resolve) => {
      autoReadStream(stream.pipeThrough(new SampleTransform()), {
        onDone: resolve,
        onChunk: async ({ chunkType, data }) => {
          if (chunkType === 'ready') {
            const { videoTrackConf, audioTrackConf } = extractFileConfig(
              data.file,
              data.info,
            );
            if (vTrackId === 0 && videoTrackConf != null) {
              vTrackId = outfile.addTrack(videoTrackConf);
            }
            if (aTrackId === 0 && audioTrackConf != null) {
              aTrackId = outfile.addTrack(audioTrackConf);
            }
          } else if (chunkType === 'samples') {
            const { type, samples } = data;
            const trackId = type === 'video' ? vTrackId : aTrackId;
            const offsetDTS = type === 'video' ? vDTS : aDTS;
            const offsetCTS = type === 'video' ? vCTS : aCTS;

            samples.forEach((s) => {
              outfile.addSample(trackId, s.data, {
                duration: s.duration,
                dts: s.dts + offsetDTS,
                cts: s.cts + offsetCTS,
                is_sync: s.is_sync,
              });
            });

            const lastSamp = samples.at(-1);
            if (lastSamp == null) return;
            if (type === 'video') {
              lastVSamp = lastSamp;
            } else if (type === 'audio') {
              lastASamp = lastSamp;
            }
          }
        },
      });
    });
    if (lastVSamp != null) {
      vDTS += lastVSamp.dts;
      vCTS += lastVSamp.cts;
    }
    if (lastASamp != null) {
      aDTS += lastASamp.dts;
      aCTS += lastASamp.cts;
    }
  }
}

/**
 * Set the correct duration value for the fmp4 files generated by WebAV
 */
export async function fixFMP4Duration(
  stream: ReadableStream<Uint8Array>,
): Promise<ReadableStream<Uint8Array>> {
  return await fastConcatMP4([stream]);
}

/**
 * 创建 MP4 音频样本解码器。
 * @param adConf - 音频解码器配置参数 {@link AudioDecoderConfig}。
 * @returns 返回一个对象，包含 `decode` 和 `close` 方法。
 * - `decode` 方法用于解码 MP4 音频样本，返回解码后的音频数据数组。
 * - `close` 方法用于关闭音频解码器。
 */
function createMP4AudioSampleDecoder(
  adConf: Parameters<AudioDecoder['configure']>[0],
) {
  let cacheAD: AudioData[] = [];
  const adDecoder = new AudioDecoder({
    output: (ad) => {
      cacheAD.push(ad);
    },
    error: Log.error,
  });
  adDecoder.configure(adConf);

  return {
    decode: async (ss: MP4Sample[]) => {
      ss.forEach((s) => {
        adDecoder.decode(
          new EncodedAudioChunk({
            type: s.is_sync ? 'key' : 'delta',
            timestamp: (1e6 * s.cts) / s.timescale,
            duration: (1e6 * s.duration) / s.timescale,
            data: s.data,
          }),
        );
      });

      await adDecoder.flush();

      const rs = cacheAD;
      cacheAD = [];

      return rs;
    },
    close: () => {
      adDecoder.close();
    },
  };
}

// 音频编码与解码API有很大区别，
// 是因为编码中途调用 AudioEncoder.flush ，会导致声音听起来卡顿
function createMP4AudioSampleEncoder(
  aeConf: Parameters<AudioEncoder['configure']>[0],
  onOutput: (s: ReturnType<typeof chunk2MP4SampleOpts>) => void,
) {
  const adEncoder = new AudioEncoder({
    output: (chunk) => {
      onOutput(chunk2MP4SampleOpts(chunk));
    },
    error: Log.error,
  });

  adEncoder.configure({
    codec: aeConf.codec,
    sampleRate: aeConf.sampleRate,
    numberOfChannels: aeConf.numberOfChannels,
  });

  // 保留一个音频数据，用于最后做声音淡出
  let lastData: { data: Float32Array; ts: number } | null = null;

  function createAD(data: Float32Array, ts: number) {
    return new AudioData({
      timestamp: ts,
      numberOfChannels: aeConf.numberOfChannels,
      numberOfFrames: data.length / aeConf.numberOfChannels,
      sampleRate: aeConf.sampleRate,
      format: 'f32-planar',
      data,
    });
  }
  return {
    encode: async (data: Float32Array, ts: number) => {
      if (lastData != null) {
        adEncoder.encode(createAD(lastData.data, lastData.ts));
      }
      lastData = { data, ts };
    },
    stop: async () => {
      if (lastData != null) {
        // 副作用修改数据
        audioFade(lastData.data, aeConf.numberOfChannels, aeConf.sampleRate);
        adEncoder.encode(createAD(lastData.data, lastData.ts));
        lastData = null;
      }
      await adEncoder.flush();
      adEncoder.close();
    },
  };
}

/**
 * 音频线性淡出，避免 POP 声
 * 副作用调整音量值
 */
function audioFade(pcmData: Float32Array, chanCnt: number, sampleRate: number) {
  const dataLen = pcmData.length - 1;
  // 避免超出边界，最长 500ms 的淡出时间
  const fadeLen = Math.min(sampleRate / 2, dataLen);
  for (let i = 0; i < fadeLen; i++) {
    for (let j = 1; j <= chanCnt; j++) {
      // 从尾部开始，调整每个声道音量值
      pcmData[Math.floor(dataLen / j) - i] *= i / fadeLen;
    }
  }
}

/**
 * 混合 MP4 与音频文件，仅重编码音频
 * @param mp4Stream - MP4 流。
 * @param audio - 音频对象，包含音频流、音量和循环属性。
 * @param audio.stream - 音频流。
 * @param audio.volume - 音频音量。
 * @param audio.loop - 是否循环播放音频。
 * @returns 输出混合后的音频流。
 */
export function mixinMP4AndAudio(
  mp4Stream: ReadableStream<Uint8Array>,
  audio: {
    stream: ReadableStream<Uint8Array>;
    volume: number;
    loop: boolean;
  },
) {
  Log.info('mixinMP4AndAudio, opts:', {
    volume: audio.volume,
    loop: audio.loop,
  });

  const outfile = mp4box.createFile();
  const { stream: outStream, stop: stopOut } = file2stream(outfile, 500);

  let audioSampleDecoder: ReturnType<
    typeof createMP4AudioSampleDecoder
  > | null = null;

  let audioSampleEncoder: ReturnType<
    typeof createMP4AudioSampleEncoder
  > | null = null;

  let inputAudioPCM: Float32Array[] = [];

  let vTrackId = 0;
  let aTrackId = 0;
  let audioOffset = 0;
  let mp4HasAudio = true;
  let sampleRate = 48000;
  autoReadStream(mp4Stream.pipeThrough(new SampleTransform()), {
    onDone: async () => {
      await audioSampleEncoder?.stop();
      audioSampleDecoder?.close();
      stopOut();
    },
    onChunk: async ({ chunkType, data }) => {
      if (chunkType === 'ready') {
        const { videoTrackConf, audioTrackConf, audioDecoderConf } =
          extractFileConfig(data.file, data.info);
        if (vTrackId === 0 && videoTrackConf != null) {
          vTrackId = outfile.addTrack(videoTrackConf);
        }

        const safeAudioTrackConf = audioTrackConf ?? {
          timescale: 1e6,
          samplerate: sampleRate,
          channel_count: DEFAULT_AUDIO_CONF.channelCount,
          hdlr: 'soun',
          name: 'SoundHandler',
          type: 'mp4a',
        };
        if (aTrackId === 0) {
          aTrackId = outfile.addTrack(safeAudioTrackConf);
          sampleRate = audioTrackConf?.samplerate ?? sampleRate;
          mp4HasAudio = audioTrackConf == null ? false : true;
        }
        const audioCtx = new AudioContext({ sampleRate });
        inputAudioPCM = extractPCM4AudioBuffer(
          await audioCtx.decodeAudioData(
            await new Response(audio.stream).arrayBuffer(),
          ),
        );

        if (audioDecoderConf != null) {
          audioSampleDecoder = createMP4AudioSampleDecoder(audioDecoderConf);
        }
        audioSampleEncoder = createMP4AudioSampleEncoder(
          audioDecoderConf ?? {
            codec:
              safeAudioTrackConf.type === 'mp4a'
                ? DEFAULT_AUDIO_CONF.codec
                : safeAudioTrackConf.type,
            numberOfChannels: safeAudioTrackConf.channel_count,
            sampleRate: safeAudioTrackConf.samplerate,
          },
          (s) => outfile.addSample(aTrackId, s.data, s),
        );
      } else if (chunkType === 'samples') {
        const { id, type, samples } = data;
        if (type === 'video') {
          samples.forEach((s) => outfile.addSample(id, s.data, s));

          if (!mp4HasAudio) await addInputAudio2Track(samples);
          return;
        }

        if (type === 'audio') await mixinAudioSampleAndInputPCM(samples);
      }
    },
  });

  /**
   * 获取输入音频切片。
   * @param len - 切片长度。
   * @returns 返回音频切片数组。
   */
  function getInputAudioSlice(len: number) {
    const rs = inputAudioPCM.map((chanBuf) =>
      audio.loop
        ? ringSliceFloat32Array(chanBuf, audioOffset, audioOffset + len)
        : chanBuf.slice(audioOffset, audioOffset + len),
    );
    audioOffset += len;

    if (audio.volume !== 1) {
      for (const buf of rs)
        for (let i = 0; i < buf.length; i++) buf[i] *= audio.volume;
    }

    return rs;
  }

  /**
   * 将输入音频添加到轨道。
   */
  async function addInputAudio2Track(vdieoSamples: MP4Sample[]) {
    const firstSamp = vdieoSamples[0];
    const lastSamp = vdieoSamples[vdieoSamples.length - 1];
    const pcmLength = Math.floor(
      ((lastSamp.cts + lastSamp.duration - firstSamp.cts) /
        lastSamp.timescale) *
        sampleRate,
    );
    const audioDataBuf = mixinPCM([getInputAudioSlice(pcmLength)]);
    if (audioDataBuf.length === 0) return;
    audioSampleEncoder?.encode(
      audioDataBuf,
      (firstSamp.cts / firstSamp.timescale) * 1e6,
    );
  }

  /**
   * 混合音频样本和输入 PCM。
   */
  async function mixinAudioSampleAndInputPCM(samples: MP4Sample[]) {
    if (audioSampleDecoder == null) return;

    // 1. 先解码mp4音频
    // [[chan0, chan1], [chan0, chan1]...]
    const pcmFragments = (await audioSampleDecoder.decode(samples)).map(
      extractPCM4AudioData,
    );
    // [chan0, chan1]
    const mp4AudioPCM = concatPCMFragments(pcmFragments);
    const inputAudioPCM = getInputAudioSlice(mp4AudioPCM[0].length);
    const firstSamp = samples[0];

    // 3. 重编码音频
    audioSampleEncoder?.encode(
      // 2. 混合输入的音频
      mixinPCM([mp4AudioPCM, inputAudioPCM]),
      (firstSamp.cts / firstSamp.timescale) * 1e6,
    );
  }

  return outStream;
}

/**
 * 创建 ESDS 盒子（MPEG-4 Elementary Stream Descriptor）。
 * ESDS 盒子用于描述 MPEG-4 的流信息，如编解码器类型、流类型、最大比特率、平均比特率等。
 * @param config - 配置信息，可以是 `ArrayBuffer` 或 `ArrayBufferView` 类型。
 * @return 返回一个 ESDS 盒子对象。
 */
function createESDSBox(config: ArrayBuffer | ArrayBufferView) {
  const configlen = config.byteLength;
  const buf = new Uint8Array([
    0x00, // version 0
    0x00,
    0x00,
    0x00, // flags

    0x03, // descriptor_type
    0x17 + configlen, // length
    0x00,
    // 0x01, // es_id
    0x02, // es_id
    0x00, // stream_priority

    0x04, // descriptor_type
    0x12 + configlen, // length
    0x40, // codec : mpeg4_audio
    0x15, // stream_type
    0x00,
    0x00,
    0x00, // buffer_size
    0x00,
    0x00,
    0x00,
    0x00, // maxBitrate
    0x00,
    0x00,
    0x00,
    0x00, // avgBitrate

    0x05, // descriptor_type

    configlen,
    ...new Uint8Array(config instanceof ArrayBuffer ? config : config.buffer),

    0x06,
    0x01,
    0x02,
  ]);

  const esdsBox = new mp4box.BoxParser.esdsBox(buf.byteLength);
  esdsBox.hdr_size = 0;
  esdsBox.parse(new mp4box.DataStream(buf, 0, mp4box.DataStream.BIG_ENDIAN));
  return esdsBox;
}
