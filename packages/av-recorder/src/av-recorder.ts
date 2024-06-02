import { Log, EventTool } from '@webav/av-cliper';
import { AVRecorderConf, IStream, IRecordeOpts } from './types';
import { RecoderPauseCtrl, startRecorde } from './recorde';

type TState = 'inactive' | 'recording' | 'paused' | 'stopped';
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

  #conf: Omit<IRecordeOpts, 'timeSlice'>;

  #recoderPauseCtrl: RecoderPauseCtrl;

  constructor(inputMediaStream: MediaStream, conf: AVRecorderConf = {}) {
    this.#conf = createRecoderConf(inputMediaStream, conf);
    this.#recoderPauseCtrl = new RecoderPauseCtrl(this.#conf.video.expectFPS);
  }

  #stopStream = () => {};
  start(timeSlice: number = 500): ReadableStream<Uint8Array> {
    if (this.#state === 'stopped') throw Error('AVRecorder is stopped');
    Log.info('AVRecorder.start recoding');

    const { streams } = this.#conf;

    if (streams.audio == null && streams.video == null) {
      throw new Error('No available tracks in MediaStream');
    }

    const { stream, exit } = startRecorde(
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

  pause(): void {
    this.#state = 'paused';
    this.#recoderPauseCtrl.pause();
    this.#evtTool.emit('stateChange', this.#state);
  }
  resume(): void {
    if (this.#state === 'stopped') throw Error('AVRecorder is stopped');
    this.#state = 'recording';
    this.#recoderPauseCtrl.play();
    this.#evtTool.emit('stateChange', this.#state);
  }

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

  const opts: Omit<IRecordeOpts, 'timeSlice'> = {
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
  let audioConf: IRecordeOpts['audio'] | null = null;
  if (audioTrack != null) {
    Object.assign(settings, audioTrack.getSettings());
    Log.info('AVRecorder recording audioConf:', audioConf);
    settings.streams.audio = new MediaStreamTrackProcessor({
      track: audioTrack,
    }).readable;
  }

  return settings;
}
