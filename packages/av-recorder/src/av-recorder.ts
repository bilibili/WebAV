import {
  Log,
  recodemux,
  autoReadStream,
  EventTool,
  file2stream,
} from '@webav/internal-utils';
import {
  AVRecorderConf,
  IStream,
  IRecordeOpts as IRecordOpts,
  TClearFn,
} from './types';

type TState = 'inactive' | 'recording' | 'paused' | 'stopped';

/**
 * 录制媒体流 MediaStream，生成 MP4 文件流
 *
 * 如果你期望录制为 WebM 格式，请使用 [MediaRecorder](https://developer.mozilla.org/en-US/docs/Web/API/MediaRecorder)
 *
 * @example
 * const recorder = new AVRecorder(
 * await navigator.mediaDevices.getUserMedia({
 *   video: true,
 *   audio: true,
 * })
);

recorder.start() // => ReadableStream
 * @see [录制摄像头](https://webav-tech.github.io/WebAV/demo/4_1-recorder-usermedia)
 */
export class AVRecorder {
  #state: TState = 'inactive';
  get state(): TState {
    return this.#state;
  }
  set state(_: TState) {
    throw new Error('state is readonly');
  }

  #evtTool = new EventTool<{
    stateChange: (state: TState) => void;
  }>();
  on = this.#evtTool.on;

  #conf: Omit<IRecordOpts, 'timeSlice'>;

  #recoderPauseCtrl: RecoderPauseCtrl;

  constructor(inputMediaStream: MediaStream, conf: AVRecorderConf = {}) {
    this.#conf = createRecoderConf(inputMediaStream, conf);
    this.#recoderPauseCtrl = new RecoderPauseCtrl(this.#conf.video.expectFPS);
  }

  #stopStream = () => {};
  /**
   * 开始录制，返回 MP4 文件流
   * @param timeSlice 控制流输出数据的时间间隔，单位毫秒
   *
   */
  start(timeSlice: number = 500): ReadableStream<Uint8Array> {
    if (this.#state === 'stopped') throw Error('AVRecorder is stopped');
    Log.info('AVRecorder.start recoding');

    const { streams } = this.#conf;

    if (streams.audio == null && streams.video == null) {
      throw new Error('No available tracks in MediaStream');
    }

    const { stream, exit } = startRecord(
      { timeSlice, ...this.#conf },
      this.#recoderPauseCtrl,
      () => {
        this.stop();
      },
    );
    this.#stopStream();
    this.#stopStream = exit;
    return stream;
  }

  /**
   * 暂停录制
   */
  pause(): void {
    this.#state = 'paused';
    this.#recoderPauseCtrl.pause();
    this.#evtTool.emit('stateChange', this.#state);
  }
  /**
   * 恢复录制
   */
  resume(): void {
    if (this.#state === 'stopped') throw Error('AVRecorder is stopped');
    this.#state = 'recording';
    this.#recoderPauseCtrl.play();
    this.#evtTool.emit('stateChange', this.#state);
  }

  /**
   * 停止
   */
  async stop(): Promise<void> {
    if (this.#state === 'stopped') return;
    this.#state = 'stopped';

    this.#stopStream();
  }
}

function createRecoderConf(inputMS: MediaStream, userConf: AVRecorderConf) {
  const conf = {
    bitrate: 3e6,
    expectFPS: 30,
    videoCodec: 'avc1.42E032',
    ...userConf,
  };
  const { streams, width, height, sampleRate, channelCount } =
    extractMSSettings(inputMS);

  const opts: Omit<IRecordOpts, 'timeSlice'> = {
    video: {
      width: width ?? 1280,
      height: height ?? 720,
      expectFPS: conf.expectFPS,
      codec: conf.videoCodec,
    },
    audio: {
      codec: 'aac',
      sampleRate: sampleRate ?? 44100,
      channelCount: channelCount ?? 2,
    },
    bitrate: conf.bitrate,
    streams,
  };
  return opts;
}

function extractMSSettings(inputMS: MediaStream) {
  const videoTrack = inputMS.getVideoTracks()[0];
  const settings: MediaTrackSettings & { streams: IStream } = { streams: {} };
  if (videoTrack != null) {
    Object.assign(settings, videoTrack.getSettings());
    settings.streams.video = new MediaStreamTrackProcessor({
      track: videoTrack,
    }).readable;
  }

  const audioTrack = inputMS.getAudioTracks()[0];
  if (audioTrack != null) {
    Object.assign(settings, audioTrack.getSettings());
    Log.info('AVRecorder recording audioConf:', settings);
    settings.streams.audio = new MediaStreamTrackProcessor({
      track: audioTrack,
    }).readable;
  }

  return settings;
}

class RecoderPauseCtrl {
  // 当前帧的偏移时间，用于计算帧的 timestamp
  #offsetTime = performance.now();

  // 编码上一帧的时间，用于计算出当前帧的持续时长
  #lastTime = this.#offsetTime;

  // 用于限制 帧率
  #frameCnt = 0;

  // 如果为true，则暂停编码数据
  // 取消暂停时，需要减去
  #paused = false;

  // 触发暂停的时间，用于计算暂停持续了多久
  #pauseTime = 0;

  // 间隔多少帧生成一个关键帧
  #gopSize = 30;

  constructor(readonly expectFPS: number) {
    this.#gopSize = Math.floor(expectFPS * 3);
  }

  start() {
    this.#offsetTime = performance.now();
    this.#lastTime = this.#offsetTime;
  }

  play() {
    if (!this.#paused) return;
    this.#paused = false;

    this.#offsetTime += performance.now() - this.#pauseTime;
    this.#lastTime += performance.now() - this.#pauseTime;
  }

  pause() {
    if (this.#paused) return;
    this.#paused = true;
    this.#pauseTime = performance.now();
  }

  transfromVideo(frame: VideoFrame) {
    const now = performance.now();
    const offsetTime = now - this.#offsetTime;
    if (
      this.#paused ||
      // 避免帧率超出期望太高
      (this.#frameCnt / offsetTime) * 1000 > this.expectFPS
    ) {
      frame.close();
      return;
    }

    const vf = new VideoFrame(frame, {
      // timestamp 单位 微秒
      timestamp: offsetTime * 1000,
      duration: (now - this.#lastTime) * 1000,
    });
    this.#lastTime = now;

    this.#frameCnt += 1;
    frame.close();
    return {
      vf,
      opts: { keyFrame: this.#frameCnt % this.#gopSize === 0 },
    };
  }

  transformAudio(ad: AudioData) {
    if (this.#paused) {
      ad.close();
      return;
    }
    return ad;
  }
}

function startRecord(
  opts: IRecordOpts,
  ctrl: RecoderPauseCtrl,
  onEnded: TClearFn,
) {
  let stopEncodeVideo: TClearFn | null = null;
  let stopEncodeAudio: TClearFn | null = null;

  const [hasVideoTrack, hasAudioTrack] = [
    opts.streams.video != null,
    opts.streams.audio != null && opts.audio != null,
  ];

  const recoder = recodemux({
    video: hasVideoTrack
      ? { ...opts.video, bitrate: opts.bitrate ?? 3_000_000 }
      : null,
    audio: hasAudioTrack ? opts.audio : null,
  });

  let stoped = false;
  if (hasVideoTrack) {
    let lastVf: VideoFrame | null = null;
    let autoInsertVFTimer = 0;
    const emitVf = (vf: VideoFrame) => {
      clearTimeout(autoInsertVFTimer);

      lastVf?.close();
      lastVf = vf;
      const vfWrap = ctrl.transfromVideo(vf.clone());
      if (vfWrap == null) return;
      recoder.encodeVideo(vfWrap.vf, vfWrap.opts);

      // 录制静态画面，MediaStream 不出帧时，每秒插入一帧
      autoInsertVFTimer = self.setTimeout(() => {
        if (lastVf == null) return;
        const newVf = new VideoFrame(lastVf, {
          timestamp: lastVf.timestamp + 1e6,
          duration: 1e6,
        });
        emitVf(newVf);
      }, 1000);
    };

    ctrl.start();
    const stopReadStream = autoReadStream(opts.streams.video!, {
      onChunk: async (chunk: VideoFrame) => {
        if (stoped) {
          chunk.close();
          return;
        }
        emitVf(chunk);
      },
      onDone: () => {},
    });

    stopEncodeVideo = () => {
      stopReadStream();
      clearTimeout(autoInsertVFTimer);
      lastVf?.close();
    };
  }

  if (hasAudioTrack) {
    stopEncodeAudio = autoReadStream(opts.streams.audio!, {
      onChunk: async (ad: AudioData) => {
        if (stoped) {
          ad.close();
          return;
        }
        const newAD = ctrl.transformAudio(ad);
        if (newAD != null) recoder.encodeAudio(ad);
      },
      onDone: () => {},
    });
  }

  const { stream, stop: stopStream } = file2stream(
    recoder.mp4file,
    opts.timeSlice,
    () => {
      exit();
      onEnded();
    },
  );

  function exit() {
    stoped = true;

    stopEncodeVideo?.();
    stopEncodeAudio?.();
    recoder.close();
    stopStream();
  }

  return { exit, stream };
}
