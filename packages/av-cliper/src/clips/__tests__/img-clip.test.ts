import { expect, test } from 'vitest';
import { ImgClip } from '..';

const animated_gif = `//${location.host}/img/animated.gif`;
const static_jpg = `//${location.host}/img/green-dog.jpeg`;

test('new ImgClip', async () => {
  const clip = new ImgClip((await fetch(static_jpg)).body!);
  expect(await clip.ready).toEqual({
    width: 712,
    height: 400,
    duration: Infinity,
  });
});

test('split by time', async () => {
  const clip = new ImgClip({
    type: 'image/gif',
    stream: (await fetch(animated_gif)).body!,
  });
  await clip.ready;
  const [preClip, postClip] = await clip.split(1e6);
  expect(clip.meta.duration).toBe(
    preClip.meta.duration + postClip.meta.duration,
  );
});

test('clone ImgClip', async () => {
  const clip = new ImgClip((await fetch(static_jpg)).body!);
  const cloneClip = await clip.clone();
  clip.destroy();
  const { state } = await cloneClip.tick(10e6);
  expect(state).toBe('success');
});
