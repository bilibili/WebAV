import { expect, test } from 'vitest';
import { MP4Clip } from '../../clips/mp4-clip';
import { createHLSLoader } from '../hls-loader';

const m3u8Url = `//${location.host}/video/m3u8/bunny.m3u8`;

test('hls loader', async () => {
  const loader = await createHLSLoader(m3u8Url);
  const [{ actualStartTime, actualEndTime, stream }] =
    loader.load(20e6, 30e6) ?? [];
  expect(stream).toBeInstanceOf(ReadableStream);
  expect({ actualStartTime, actualEndTime }).toEqual({
    actualStartTime: 15.75e6,
    actualEndTime: 32e6,
  });

  const clip = new MP4Clip(stream);
  await clip.ready;
  expect(Math.round(clip.meta.duration / 1e6)).toBe(
    Math.round((actualEndTime - actualStartTime) / 1e6),
  );

  const { video } = await clip.tick(10e6);
  expect(video?.timestamp).toBe(10e6);
  video?.close();
});
