import { beforeAll, describe, expect, test, vi } from 'vitest';
import mp4box from '@webav/mp4box.js';
import { file2stream } from '..';
import { autoReadStream } from '../../av-utils';

beforeAll(() => {
  vi.useFakeTimers();
});

describe('file2stream', () => {
  test('enqueue data to stream', () => {
    const file = mp4box.createFile();
    file.boxes.push(
      // @ts-expect-error
      ...Array(5)
        .fill(0)
        .map((_, idx) => ({
          type: ['ftyp', 'moov', 'moof', 'mdat'][idx],
          write: (ds: any) => {
            ds.writeUint8Array(new Uint8Array([1]));
          },
        })),
    );

    const { stop, stream } = file2stream(file, 500);
    expect(stream).toBeInstanceOf(ReadableStream);
    expect(stop).toBeInstanceOf(Function);

    vi.advanceTimersByTime(500);

    autoReadStream(stream, {
      onChunk: async (chunk) => {
        expect(chunk).toEqual(new Uint8Array([1, 1, 1, 1, 1]));
      },
      onDone: () => {},
    });
    // 内存引用被清理
    expect([...file.boxes]).toEqual(Array(5).fill(undefined));
  });

  test('stop stream', () => {
    const file = mp4box.createFile();
    // @ts-expect-error
    file.boxes = Array(5)
      .fill(0)
      .map(() => ({ write: vi.fn(), data: new ArrayBuffer(0) }));
    vi.spyOn(file, 'flush');
    vi.spyOn(globalThis, 'clearInterval');

    const { stop } = file2stream(file, 500);
    stop();

    expect(file.flush).toBeCalled();
    expect(vi.getTimerCount()).toBe(1);
    expect(globalThis.clearInterval).toBeCalled();
  });

  test('cancel stream', () => {
    const file = mp4box.createFile();
    // @ts-expect-error
    file.boxes = Array(5)
      .fill(0)
      .map(() => ({ write: vi.fn(), data: new ArrayBuffer(0) }));
    vi.spyOn(file, 'flush');
    vi.spyOn(globalThis, 'clearInterval');

    const spyCancel = vi.fn();
    const { stream } = file2stream(file, 500, spyCancel);
    stream.cancel();

    expect(globalThis.clearInterval).toBeCalled();
    expect(spyCancel).toBeCalled();
  });
});
