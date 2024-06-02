import { Log, EventTool } from '@webav/av-cliper';
import { IRecorderConf, IStream, IRecordeOpts } from './types';
import { MP4Muxer } from './mux-mp4';

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

  #muxer = new MP4Muxer();

  #outputStream: ReadableStream<Uint8Array> | null = null;
  get outputStream() {
    return this.#outputStream;
  }

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
  }

  start(timeSlice: number = 500): void {
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

    const workerOpts: IRecordeOpts = {
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

    this.#outputStream = this.#muxer.start(workerOpts, this.stop);
  }

  pause(): void {
    this.#state = 'paused';
    this.#muxer.pause();
    this.#evtTool.emit('stateChange', this.#state);
  }
  resume(): void {
    if (this.#state === 'stopped') throw Error('AVRecorder is stopped');
    this.#state = 'recording';
    this.#muxer.resume();
    this.#evtTool.emit('stateChange', this.#state);
  }

  async stop(): Promise<void> {
    if (this.#state === 'stopped') return;
    this.#state = 'stopped';

    this.#muxer.stop();
  }
}
