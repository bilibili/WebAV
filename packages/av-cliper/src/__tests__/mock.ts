import { vi } from 'vitest';
import { DEFAULT_AUDIO_CONF } from '../clips';

export const MediaStreamMock = {
  getTracks: vi.fn().mockReturnValue([]),
  getAudioTracks: vi.fn().mockReturnValue([]),
  removeTrack: vi.fn(),
  addTrack: vi.fn(),
};

Object.assign(global, {
  MediaStream: vi.fn().mockImplementation(() => {
    return Object.assign(Object.create(MediaStream.prototype), MediaStreamMock);
  }),
});

export const AudioBufferMock = {
  duration: 0,
  sampleRate: DEFAULT_AUDIO_CONF.sampleRate,
  getChannelData: vi.fn().mockReturnValue(new Float32Array(0)),
};

Object.assign(global, {
  AudioBuffer: vi.fn().mockImplementation(() => {
    return Object.assign(Object.create(AudioBuffer.prototype), AudioBufferMock);
  }),
});

export const AudioContextMock = {
  createGain: vi.fn().mockImplementation(() => {
    return {
      gain: vi.fn(),
      disconnect: vi.fn(),
    };
  }),
  createMediaElementSource: vi.fn().mockImplementation(() => {
    return { connect: vi.fn() };
  }),
  createMediaStreamSource: vi.fn().mockImplementation(() => {
    return { connect: vi.fn() };
  }),
  createMediaStreamDestination: vi.fn().mockImplementation(() => {
    return {
      disconnect: vi.fn(),
      stream: new MediaStream(),
    };
  }),
  createOscillator: vi.fn().mockImplementation(() => {
    return {
      start: vi.fn(),
      setPeriodicWave: vi.fn(),
      connect: vi.fn(),
    };
  }),
  createPeriodicWave: vi.fn(),
  close: vi.fn().mockImplementation(async () => await Promise.resolve()),
  // @ts-expect-error
  decodeAudioData: vi.fn().mockImplementation(async () => new AudioBuffer()),
};

Object.assign(global, {
  AudioContext: vi.fn().mockImplementation(() => {
    return Object.assign(
      Object.create(AudioContext.prototype),
      AudioContextMock,
    );
  }),
});

vi.spyOn(HTMLVideoElement.prototype, 'addEventListener').mockImplementation(
  (_, handler: any) => {
    handler();
  },
);

vi.spyOn(HTMLVideoElement.prototype, 'play').mockImplementation(async () => {
  return await Promise.resolve();
});

vi.spyOn(HTMLAudioElement.prototype, 'play').mockImplementation(async () => {
  return await Promise.resolve();
});

vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => {
  return {
    drawImage: vi.fn(),
    fillRect: vi.fn(),
    rotate: vi.fn(),
    setTransform: vi.fn(),
    resetTransform: vi.fn(),
  } as unknown as CanvasRenderingContext2D;
});

export const CvsElementMock = {
  clientWidth: vi
    .spyOn(HTMLCanvasElement.prototype, 'clientWidth', 'get')
    .mockImplementation(() => 0),
  clientHeight: vi
    .spyOn(HTMLCanvasElement.prototype, 'clientHeight', 'get')
    .mockImplementation(() => 0),
};

export const cvsCaptureStreamMock = vi.fn().mockReturnValue(new MediaStream());
Object.assign(HTMLCanvasElement.prototype, {
  captureStream: cvsCaptureStreamMock,
});

export const getBoundingClientRectMock = vi.spyOn(
  HTMLElement.prototype,
  'getBoundingClientRect',
);

export const createObjectURLMock = (URL.createObjectURL = vi.fn());
export const revokeObjectURLMock = (URL.revokeObjectURL = vi.fn());

/**
 * Mock 鼠标事件，初始化 offsetXY 值
 * @param evtName
 * @param offsetX
 * @param offsetY
 * @returns
 */
export function crtMSEvt4Offset(
  evtName: string,
  offsetX: number,
  offsetY: number,
): MouseEvent {
  const evt = new MouseEvent(evtName);
  vi.spyOn(evt, 'offsetX', 'get').mockImplementation(() => offsetX);
  vi.spyOn(evt, 'offsetY', 'get').mockImplementation(() => offsetY);
  return evt;
}

declare global {
  interface ReadableStream<R = any> {
    _ctrl: ReadableStreamController<R>;
  }
}

Object.assign(global, {
  ReadableStream: vi.fn().mockImplementation((arg) => {
    const ctrl = {
      enqueue: vi.fn(),
      close: vi.fn(),
    };
    arg?.start(ctrl);
    return Object.assign(Object.create(ReadableStream.prototype), {
      _ctrl: ctrl,
      cancel: () => {
        arg?.cancel();
      },
    });
  }),
});

Object.assign(global, {
  Response: vi.fn().mockImplementation(() => {
    return Object.assign(Object.create(Response.prototype), {
      arrayBuffer: vi.fn(),
    });
  }),
});

export const OffscreenCanvasRenderingContext2DMock = {
  fillText: vi.fn(),
  clearRect: vi.fn(),
  measureText: vi.fn().mockReturnValue({}),
  strokeText: vi.fn(),
  fillStyle: '',
};

Object.assign(global, {
  OffscreenCanvasRenderingContext2D: vi.fn().mockImplementation(() => {
    return Object.assign(
      Object.create(OffscreenCanvasRenderingContext2D.prototype),
      OffscreenCanvasRenderingContext2DMock,
    );
  }),
});

Object.assign(global, {
  OffscreenCanvas: vi.fn().mockImplementation(() => {
    return Object.assign(Object.create(OffscreenCanvas.prototype), {
      getContext: () => new OffscreenCanvasRenderingContext2D(),
    });
  }),
});

class Worker {
  url: string;
  onmessage: (msg: string) => void;

  constructor(stringUrl: string) {
    this.url = stringUrl;
    this.onmessage = () => {};
  }

  postMessage(msg: string) {
    this.onmessage(msg);
  }
}
Object.assign(global, { Worker });
