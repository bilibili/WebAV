import { ImgClip, MP4Clip } from '../src/clips';
import { Combinator } from '../src/combinator';
import { Log } from '../src/log';
import { OffscreenSprite } from '../src/sprite/offscreen-sprite';
import { renderTxt2ImgBitmap } from '../src/dom-utils';
import { file, write } from 'opfs-tools';

const progressEl = document.querySelector('#progress')!;
const startTimeEl = document.querySelector('#startTime')!;
const costEl = document.querySelector('#cost')!;

document.querySelector('#frag-10min')?.addEventListener('click', () => {
  (async () => {
    const resPath = '/video/pri-bunny_1080p_avc-frag.mp4';
    // const resPath = '/video/pri-cut-5.mp4';
    // const resPath = '/video/bunny_0.mp4';

    const otFile = file(resPath);

    if (!(await otFile.exists())) {
      await write(otFile, (await fetch(resPath)).body!);
    }

    let t = performance.now();
    const spr1 = new OffscreenSprite(new MP4Clip(otFile));
    await spr1.ready;
    console.log('111111111', performance.now() - t);
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
