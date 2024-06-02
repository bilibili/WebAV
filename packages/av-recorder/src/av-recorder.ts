import { Log, EventTool } from '@webav/av-cliper';
import { IRecorderConf, IStream, IRecordeOpts } from './types';
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

  #ms;

  #conf: Required<IRecorderConf>;

  #recoderPauseCtrl: RecoderPauseCtrl;

  constructor(inputMediaStream: MediaStream, conf: IRecorderConf = {}) {
    this.#ms = inputMediaStream;
    this.#conf = {
      width: 1280,
      height: 720,
      bitrate: 3_000_000,
      expectFPS: 30,
      audioCodec: 'aac',
      videoCodec: 'avc1.42E032',
      ...conf,
    };

    this.#recoderPauseCtrl = new RecoderPauseCtrl(this.#conf.expectFPS);
  }

  #stopStream = () => {};
  start(timeSlice: number = 500): ReadableStream<Uint8Array> {
    if (this.#state === 'stopped') throw Error('AVRecorder is stopped');
    Log.info('AVRecorder.start recoding');

    const streams: IStream = {};
    const videoTrack = this.#ms.getVideoTracks()[0];
    if (videoTrack != null) {
      streams.video = new MediaStreamTrackProcessor({
        track: videoTrack,
      }).readable;
    }

    const audioTrack = this.#ms.getAudioTracks()[0];
    let audioConf: IRecordeOpts['audio'] | null = null;
    if (audioTrack != null) {
      const setting = audioTrack.getSettings();
      audioConf = {
        codec: this.#conf.audioCodec,
        sampleRate: setting.sampleRate ?? 0,
        channelCount: setting.channelCount ?? 0,
      };
      Log.info('AVRecorder recording audioConf:', audioConf);
      streams.audio = new MediaStreamTrackProcessor({
        track: audioTrack,
      }).readable;
    }

    if (streams.audio == null && streams.video == null) {
      throw new Error('No available tracks in MediaStream');
    }

    const opts: IRecordeOpts = {
      video: {
        width: this.#conf.width,
        height: this.#conf.height,
        expectFPS: this.#conf.expectFPS,
        codec: this.#conf.videoCodec,
      },
      audio: audioConf,
      bitrate: this.#conf.bitrate,
      timeSlice,
      streams,
    };

    const { stream, exit } = startRecorde(opts, this.#recoderPauseCtrl, () => {
      this.stop();
    });
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
