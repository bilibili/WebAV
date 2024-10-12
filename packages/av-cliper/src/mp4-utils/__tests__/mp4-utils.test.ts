import { beforeAll, describe, expect, test, vi } from 'vitest';
import mp4box from '@webav/mp4box.js';
import { autoReadStream, file2stream } from '@webav/internal-utils';
import { file, write } from 'opfs-tools';
import { quickParseMP4File } from '../mp4box-utils';

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

const mp4_123 = `//${location.host}/video/123.mp4`;
test('quickParseMP4File', async () => {
  const f = file('/unit-test/123.mp4');
  await write(f, (await fetch(mp4_123)).body!);
  const reader = await f.createReader();
  let sampleCount = 0;
  await quickParseMP4File(
    reader,
    ({ info }) => {
      expect(info.timescale).toBe(1000);
      expect(info.duration).toBe(1024);
      expect(info.isFragmented).toBe(false);
      expect(info.tracks.length).toBe(2);
    },
    (_, __, samples) => {
      sampleCount += samples.length;
    },
  );
  expect(sampleCount).toBe(40);
  await reader.close();
});
