import mp4box, { MP4File, SampleOpts } from '@webav/mp4box.js';
import { EventTool } from './event-tool';
import { createMetaBox } from './meta-box';
import { workerTimer } from './worker-timer';
import { Log } from './log';

type TCleanFn = () => void;

/**
 * 定义 recodemux 函数的配置选项
 */
interface IRecodeMuxOpts {
  /**
   * 视频配置选项，如果为 null 则不处理视频。
   */
  video: {
    width: number;
    height: number;
    expectFPS: number;
    codec: string;
    bitrate: number;
    /**
     * 不安全，随时可能废弃
     */
    __unsafe_hardwareAcceleration__?: HardwareAcceleration;
  } | null;
  /**
   * 音频配置选项，如果为 null 则不处理音频。
   */
  audio: {
    codec: 'opus' | 'aac';
    sampleRate: number;
    channelCount: number;
  } | null;
  /**
   * 预设时长，不代表 track 实际时长
   */
  duration?: number;
  metaDataTags?: Record<string, string>;
}

/**
 * 处理音视频的编码和解码。
 * @param opts - 编码音视频数据的配置
 */
export function recodemux(opts: IRecodeMuxOpts): {
  /**
   * 编码视频帧
   */
  encodeVideo: (
    frame: VideoFrame,
    options: VideoEncoderEncodeOptions,
    gopId?: number,
  ) => void;
  /**
   * 编码音频数据
   */
  encodeAudio: (data: AudioData) => void;
  /**
   * close 编码器，停止任务
   */
  close: TCleanFn;
  /**
   * 清空编码器队列
   */
  flush: () => Promise<void>;
  /**
   * mp4box 实例
   */
  mp4file: MP4File;
  /**
   * 返回队列长度（背压），用于控制生产视频的进度，队列过大会会占用大量显存
   */
  getEncodeQueueSize: () => number;
} {
  Log.info('recodemux opts:', opts);
  const mp4file = mp4box.createFile();

  // 音视频轨道必须同时创建, 保存在 moov 中
  const avSyncEvtTool = new EventTool<
    Record<'VideoReady' | 'AudioReady', () => void>
  >();

  const addMetadata = (
    moov: NonNullable<MP4File['moov']>,
    tags: NonNullable<IRecodeMuxOpts['metaDataTags']>,
  ) => {
    const udtaBox = moov.add('udta');
    const metaBox = udtaBox.add('meta');
    metaBox.data = createMetaBox(tags);
    metaBox.size = metaBox.data.byteLength;
  };

  let moovReady = false;
  const onMoovReady = () => {
    if (mp4file.moov == null || moovReady) return;
    moovReady = true;

    if (opts.metaDataTags != null) addMetadata(mp4file.moov, opts.metaDataTags);
    if (opts.duration != null) {
      mp4file.moov.mvhd.duration = opts.duration;
    }
  };

  avSyncEvtTool.once('VideoReady', onMoovReady);
  avSyncEvtTool.once('AudioReady', onMoovReady);

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
      try {
        aEncoder.encode(ad);
        ad.close();
      } catch (err) {
        const errMsg = `encode audio chunk error: ${(err as Error).message}, state: ${JSON.stringify(
          {
            qSize: aEncoder.encodeQueueSize,
            state: aEncoder.state,
          },
        )}`;
        Log.error(errMsg);
        throw Error(errMsg);
      }
    },
    getEncodeQueueSize: () =>
      vEncoder?.encodeQueueSize ?? aEncoder?.encodeQueueSize ?? 0,
    flush: async () => {
      await Promise.all([
        vEncoder?.flush(),
        aEncoder?.state === 'configured' ? aEncoder.flush() : null,
      ]);
      return;
    },
    close: () => {
      avSyncEvtTool.destroy();
      vEncoder?.close();
      if (aEncoder?.state === 'configured') aEncoder.close();
    },
    mp4file,
  };
}

function encodeVideoTrack(
  opts: NonNullable<IRecodeMuxOpts['video']>,
  mp4File: MP4File,
  avSyncEvtTool: EventTool<Record<'VideoReady' | 'AudioReady', () => void>>,
) {
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
  let audioReady = false;
  avSyncEvtTool.once('AudioReady', () => {
    audioReady = true;
  });

  const samplesCache: Record<
    'encoder0' | 'encoder1',
    Array<ReturnType<typeof chunk2MP4SampleOpts>>
  > = {
    encoder0: [],
    encoder1: [],
  };
  const outputHandler = (
    encId: 'encoder0' | 'encoder1',
    chunk: EncodedVideoChunk,
    meta?: EncodedVideoChunkMetadata,
  ) => {
    if (trackId === -1 && meta != null) {
      const desc = meta.decoderConfig?.description as ArrayBuffer;
      fixChromeConstraintSetFlagsBug(desc);
      videoTrackOpts.avcDecoderConfigRecord = desc;
      trackId = mp4File.addTrack(videoTrackOpts);
      avSyncEvtTool.emit('VideoReady');
      Log.info('VideoEncoder, video track ready, trackId:', trackId);
    }

    samplesCache[encId].push(chunk2MP4SampleOpts(chunk));
  };

  let curEncId: 'encoder0' | 'encoder1' = 'encoder1';
  let lastAddedSampleTime = 0;
  // 双编码器交替消费，保证帧的顺序
  // 小于期望帧间隔帧判定为连续的
  const deltaTime = Math.floor((1000 / opts.expectFPS) * 1e3);
  function checkCache() {
    if (!audioReady) return;
    const nextEncId = curEncId === 'encoder1' ? 'encoder0' : 'encoder1';
    const curCache = samplesCache[curEncId];
    const nextCache = samplesCache[nextEncId];
    // 无数据
    if (curCache.length === 0 && nextCache.length === 0) return;

    let curFirst = curCache[0];
    // 当前队列正在进行中（非关键帧 或 时间连续），继续消费
    if (curFirst != null) {
      if (!curFirst.is_sync || curFirst.cts - lastAddedSampleTime < deltaTime) {
        const lastTs = addSampleToFile(curCache);
        if (lastTs > lastAddedSampleTime) lastAddedSampleTime = lastTs;
      }
    }

    const nextFirst = nextCache[0];

    // 另一个队列跟已消费的最后一帧是连续的，则需要切换
    if (nextFirst?.is_sync && nextFirst.cts - lastAddedSampleTime < deltaTime) {
      curEncId = nextEncId;
      // 说明另一个队列有数据，尽快消费
      checkCache();
      return;
    }

    // 如果时间不连续，但两个队列都有数据，且都是关键帧，消费时间较早的队列
    if (curFirst?.is_sync && nextFirst?.is_sync) {
      if (curFirst.cts <= nextFirst.cts) {
        const lastTs = addSampleToFile(curCache);
        if (lastTs > lastAddedSampleTime) lastAddedSampleTime = lastTs;
      } else {
        curEncId = nextEncId;
        // 说明另一个队列有数据，尽快消费
        checkCache();
        return;
      }
    }
  }

  function addSampleToFile(
    chunks: Array<ReturnType<typeof chunk2MP4SampleOpts>>,
  ) {
    let lastTime = -1;
    let i = 0;
    for (; i < chunks.length; i++) {
      const c = chunks[i];
      // 每次消费到下一个关键帧结束，可能需要切换队列
      if (i > 0 && c.is_sync) break;

      mp4File.addSample(trackId, c.data, c);
      lastTime = c.cts + c.duration;
    }
    chunks.splice(0, i);
    return lastTime;
  }

  const stopTimer = workerTimer(checkCache, 15);

  const encoder0 = createVideoEncoder(opts, (chunk, meta) =>
    outputHandler('encoder0', chunk, meta),
  );
  const encoder1 = createVideoEncoder(opts, (chunk, meta) =>
    outputHandler('encoder1', chunk, meta),
  );

  let gopId = 0;
  return {
    get encodeQueueSize() {
      return encoder0.encodeQueueSize + encoder1.encodeQueueSize;
    },
    encode: (vf: VideoFrame, opts: VideoEncoderEncodeOptions) => {
      try {
        if (opts.keyFrame) gopId += 1;
        const encoder = gopId % 2 === 0 ? encoder0 : encoder1;
        encoder.encode(vf, opts);
      } catch (err) {
        const errMsg = `encode video frame error: ${(err as Error).message}, state: ${JSON.stringify(
          {
            ts: vf.timestamp,
            keyFrame: opts.keyFrame,
            duration: vf.duration,
            gopId,
          },
        )}`;
        Log.error(errMsg);
        throw Error(errMsg);
      }
    },
    flush: async () => {
      await Promise.all([
        encoder0.state === 'configured' ? await encoder0.flush() : null,
        encoder1.state === 'configured' ? await encoder1.flush() : null,
      ]);
      stopTimer();
      checkCache();
    },
    close: () => {
      if (encoder0.state === 'configured') encoder0.close();
      if (encoder1.state === 'configured') encoder1.close();
    },
  };
}

// https://github.com/WebAV-Tech/WebAV/issues/203
function fixChromeConstraintSetFlagsBug(desc: ArrayBuffer) {
  const u8 = new Uint8Array(desc);
  const constraintSetFlag = u8[2];
  // 如果 constraint_set_flags 字节二进制 第0位或第1位值为1
  // 说明取值错误，忽略该字段避免解码异常
  if (constraintSetFlag.toString(2).slice(-2).includes('1')) {
    u8[2] = 0;
  }
}

function createVideoEncoder(
  videoOpts: NonNullable<IRecodeMuxOpts['video']>,
  outHandler: EncodedVideoChunkOutputCallback,
): VideoEncoder {
  const encoderConf = {
    codec: videoOpts.codec,
    framerate: videoOpts.expectFPS,
    hardwareAcceleration: videoOpts.__unsafe_hardwareAcceleration__,
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
  } as const;
  const encoder = new VideoEncoder({
    error: (err) => {
      const errMsg = `VideoEncoder error: ${err.message}, config: ${JSON.stringify(encoderConf)}, state: ${JSON.stringify(
        {
          qSize: encoder.encodeQueueSize,
          state: encoder.state,
        },
      )}`;
      Log.error(errMsg);
      throw Error(errMsg);
    },
    output: outHandler,
  });

  encoder.configure(encoderConf);
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

  const encoderConf = {
    codec: audioOpts.codec === 'aac' ? 'mp4a.40.2' : 'opus',
    sampleRate: audioOpts.sampleRate,
    numberOfChannels: audioOpts.channelCount,
    bitrate: 128_000,
  } as const;

  const encoder = new AudioEncoder({
    error: (err) => {
      const errMsg = `AudioEncoder error: ${err.message}, config: ${JSON.stringify(
        encoderConf,
      )}, state: ${JSON.stringify({
        qSize: encoder.encodeQueueSize,
        state: encoder.state,
      })}`;
      Log.error(errMsg);
      throw Error(errMsg);
    },
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
  encoder.configure(encoderConf);

  return encoder;
}

/**
 * 创建 ESDS 盒子（MPEG-4 Elementary Stream Descriptor）
 * ESDS 盒子用于描述 MPEG-4 的流信息，如编解码器类型、流类型、最大比特率、平均比特率等
 * @param config - 配置信息，可以是 `ArrayBuffer` 或 `ArrayBufferView` 类型
 * @return 返回一个 ESDS box
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
