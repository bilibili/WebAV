import { expect, test } from 'vitest';
import { MP4Clip } from '..';
import { parseHLSStream } from '../m3u8-parser';

const m3u8Url = `//${location.host}/video/m3u8/bunny.m3u8`;

test('parseHLSStream', async () => {
  const streams = await parseHLSStream(m3u8Url);
  const clip = new MP4Clip(streams[0]);
  await clip.ready;
  expect(Math.round(clip.meta.duration / 1e6)).toBe(60);

  const { video } = await clip.tick(10e6);
  expect(video?.timestamp).toBe(10e6);
  video?.close();
});
