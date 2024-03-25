import { expect, test } from 'vitest';
import { MP4Clip } from '../mp4-clip';

const mp4_123 = `//${location.host}/video/123.mp4`;

async function fastestDecode(clip: MP4Clip) {
  let time = 0;
  while (true) {
    const { state, video } = await clip.tick(time);
    video?.close();
    if (state === 'done') break;
    time += 33000;
  }
}

test('fastest decode', async () => {
  const clip = new MP4Clip((await fetch(mp4_123)).body!);
  let frameCnt = 0;
  clip.tickInterceptor = async (_, tickRet) => {
    if (tickRet.video != null) frameCnt += 1;
    return tickRet;
  };
  await clip.ready;
  await fastestDecode(clip);
  clip.destroy();

  expect(frameCnt).toBe(23);
});

const mp4_bunny = `//${location.host}/video/bunny.mp4`;
test('delete range', async () => {
  const clip = new MP4Clip((await fetch(mp4_bunny)).body!, { audio: true });
  let frameCnt = 0;
  clip.tickInterceptor = async (_, tickRet) => {
    if (tickRet.video != null) frameCnt += 1;
    return tickRet;
  };
  const { duration } = await clip.ready;
  // 时长 60s
  expect(Math.round(duration / 1e6)).toBe(60);
  // 删除前 25s, 剩余 35s
  clip.deleteRange(0, 25e6);
  // 删除 10s 后的 50s(超出视频长度)，实际删除 10～35s
  clip.deleteRange(10e6, 50e6);
  // 剩余 10s
  expect(Math.round(clip.meta.duration / 1e6)).toBe(10);
  await fastestDecode(clip);
  clip.destroy();

  expect(frameCnt).toBe(240);
});

test('thumbnails', async () => {
  const clip = new MP4Clip((await fetch(mp4_bunny)).body!);
  await clip.ready;
  expect((await clip.thumbnails()).length).toBe(9);
  clip.destroy();
});

const mp4_bunny_1 = `//${location.host}/video/bunny_1.mp4`;

test('clone mp4clip', async () => {
  const clip = new MP4Clip((await fetch(mp4_bunny_1)).body!);
  await clip.ready;
  clip.deleteRange(0, 10e6);
  const tickInterceptor = (_, __) => __;
  clip.tickInterceptor = tickInterceptor;

  const cloned = await clip.clone();
  expect(cloned.meta).toEqual(clip.meta);
  expect(cloned.tickInterceptor).toEqual(tickInterceptor);

  cloned.destroy();
  clip.destroy();
});

test('preview frame by time', async () => {
  const clip = new MP4Clip((await fetch(mp4_bunny_1)).body!);
  await clip.ready;
  expect((await clip.tick(1e6)).video?.timestamp).toBe(1e6);
  expect((await clip.tick(1e6)).video?.timestamp).toBe(1e6);
  clip.destroy();
});
