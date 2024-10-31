import { ImgClip, MP4Clip } from '../src/clips';
import { Log, Combinator } from '../src';
import { OffscreenSprite } from '../src/sprite/offscreen-sprite';
import { renderTxt2ImgBitmap } from '../src/dom-utils';
import { file, write } from 'opfs-tools';

const progressEl = document.querySelector('#progress')!;
const startTimeEl = document.querySelector('#startTime')!;
const costEl = document.querySelector('#cost')!;

async function loadFile(path: string) {
  const otFile = file(path);

  if (!(await otFile.exists())) {
    await write(otFile, (await fetch(path)).body!);
  }
  return otFile;
}

document.querySelector('#frag-10min')?.addEventListener('click', () => {
  (async () => {
    const resPath = '/video/pri-bunny_1080p_avc-frag.mp4';
    // const resPath = '/video/pri-cut-5.mp4';
    // const resPath = '/video/bunny_0.mp4';

    const spr1 = new OffscreenSprite(new MP4Clip(await loadFile(resPath)));
    await spr1.ready;
    const width = 1920;
    const height = 1080;
    // spr1.rect.y = (height - spr1.rect.h) / 2;
    // spr1.rect.w = 1920;

    const spr2 = new OffscreenSprite(
      new ImgClip(
        await renderTxt2ImgBitmap(
          '示例文字',
          `font-size:40px; color: white; text-shadow: 2px 2px 6px red;`,
        ),
      ),
    );
    await spr2.ready;
    spr2.rect.x = (width - spr2.rect.w) / 2;
    spr2.rect.y = (height - spr2.rect.h) / 2;

    spr1.time.duration = 100e6;
    console.log('resolution:', { width, height });
    const com = new Combinator({
      width,
      height,
      videoCodec: 'avc1.4d4028',
      bgColor: 'black',
      bitrate: 3e6,
      // audio: false,
      metaDataTags: { hello: 'world' },
    });

    await com.addSprite(spr1, { main: true });
    await com.addSprite(spr2);

    startTimeEl.textContent = new Date().toLocaleTimeString();
    let startTs = performance.now();
    com.on('OutputProgress', (v) => {
      progressEl.textContent = Math.round(v * 100) + '%';
      if (v === 1) {
        costEl.textContent = String(~~(performance.now() - startTs));
      }
    });

    write(
      file(`/perf-test/${new Date().toLocaleTimeString()}.mp4`),
      com.output(),
    );
    // com.output().pipeTo(await createFileWriter());
  })().catch(Log.error);
});

document.querySelector('#parse-larage-file')?.addEventListener('click', () => {
  (async () => {
    const resPath = '/video/pri-Interstellar.mp4';
    const st = performance.now();
    const clip = new MP4Clip(await loadFile(resPath));
    await clip.ready;
    document.querySelector('#parse-time-cost')!.textContent = String(
      Math.round(performance.now() - st),
    );
    clip.destroy();
  })().catch(Log.error);
});
