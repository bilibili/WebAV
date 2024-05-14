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

const m4aUrl = `//${location.host}/audio/44.1kHz-2chan.m4a`;
test('decode m4a', async () => {
  const clip = new MP4Clip((await fetch(m4aUrl)).body!, { audio: true });
  await clip.ready;
  clip.destroy();

  expect(Math.round(clip.meta.duration / 1e6)).toBe(122);
});

const mp4_bunny = `//${location.host}/video/bunny.mp4`;

test('thumbnails', async () => {
  const clip = new MP4Clip((await fetch(mp4_bunny)).body!);
  await clip.ready;
  const thumbnails = await clip.thumbnails();
  expect(thumbnails.length).toBe(9);
  expect((await createImageBitmap(thumbnails[0].img)).width).toBe(100);
  const thumbnails150 = await clip.thumbnails(150, {
    start: 1e6,
    end: 10e6,
    step: 1e6,
  });
  expect(thumbnails150.length).toBe(10);
  expect((await createImageBitmap(thumbnails150[0].img)).width).toBe(150);
  clip.destroy();
});

const mp4_bunny_1 = `//${location.host}/video/bunny_1.mp4`;

test('clone mp4clip', async () => {
  const clip = new MP4Clip((await fetch(mp4_bunny_1)).body!);
  await clip.ready;
  const tickInterceptor: MP4Clip['tickInterceptor'] = (_, __) => __;
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

test('split track', async () => {
  const clip = new MP4Clip((await fetch(mp4_bunny_1)).body!, { audio: true });
  await clip.ready;
  const trackClips = await clip.splitTrack();
  expect(trackClips.length).toBe(2);
  // video clip
  expect(trackClips[0].meta.width).toBe(640);
  expect(trackClips[0].meta.audioChanCount).toBe(0);
  expect(Math.round(trackClips[0].meta.duration / 1e6)).toBe(21);
  // audio clip
  expect(trackClips[1].meta.width).toBe(0);
  expect(trackClips[1].meta.audioChanCount).toBe(2);
  expect(Math.round(trackClips[1].meta.duration / 1e6)).toBe(21);
});

test('splitTrack when only has video track', async () => {
  const clip = new MP4Clip((await fetch(mp4_bunny_1)).body!, { audio: false });
  await clip.ready;
  const trackClips = await clip.splitTrack();
  expect(trackClips.length).toBe(1);
  // video clip
  expect(trackClips[0].meta.width).toBe(640);
  expect(trackClips[0].meta.audioChanCount).toBe(0);
  expect(Math.round(trackClips[0].meta.duration / 1e6)).toBe(21);
});

test('split MP4Clip by time', async () => {
  const clip = new MP4Clip((await fetch(mp4_bunny_1)).body!);
  const [preClip1, postClip2] = await clip.split(10e6);
  expect(Math.round(preClip1.meta.duration / 1e6)).toEqual(10);
  expect(Math.round(postClip2.meta.duration / 1e6)).toEqual(11);
  expect(preClip1.meta.audioChanCount).toBe(2);
  expect(postClip2.meta.audioChanCount).toBe(2);
  // second split
  const [preClip11, postClip12] = await preClip1.split(5e6);
  expect(Math.round(preClip11.meta.duration / 1e6)).toEqual(5);
  expect(Math.round(postClip12.meta.duration / 1e6)).toEqual(5);

  const [preClip21, postClip22] = await postClip2.split(5e6);
  expect(Math.round(preClip21.meta.duration / 1e6)).toEqual(5);
  expect(Math.round(postClip22.meta.duration / 1e6)).toEqual(6);
});
