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
  // 删除前 25s
  clip.deleteRange(0, 25e6);
  // 删除后 25s
  clip.deleteRange(10e6, 35e6);
  // 剩余 10s
  expect(Math.round(clip.meta.duration / 1e6)).toBe(10);
  await fastestDecode(clip);
  clip.destroy();

  expect(frameCnt).toBe(205);
});

test('thumbnails', async () => {
  const clip = new MP4Clip((await fetch(mp4_bunny)).body!);
  await clip.ready;
  expect((await clip.thumbnails()).length).toBe(9);
});

const mp4_bunny_1 = `//${location.host}/video/bunny_1.mp4`;
test('getVideoFrame', async () => {
  const clip = new MP4Clip((await fetch(mp4_bunny_1)).body!);
  await clip.ready;
  let vf = await clip.getVideoFrame(0);
  expect(vf).toBe(null);
});
