import { AudioClip, ImgClip, MP4Clip, concatAudioClip } from '../src/clips';
import { Combinator } from '../src/combinator';
import { Log } from '../src/log';
import { OffscreenSprite } from '../src/sprite/offscreen-sprite';
import { renderTxt2ImgBitmap } from '../src/dom-utils';
import { EmbedSubtitlesClip } from '../src/clips/embed-subtitles-clip';
import { playOutputStream } from './play-video';
import { createChromakey, fastConcatMP4 } from '../src';

// const cvs = document.querySelector('canvas') as HTMLCanvasElement
// const ctx = cvs.getContext('2d')!
(async () => {
  if (!(await Combinator.isSupported())) {
    alert('Your browser does not support WebCodecs');
  }
})();

const playerContiner = document.querySelector('#player-continer')!;

document.querySelector('#mp4-img')?.addEventListener('click', () => {
  (async () => {
    const resList = ['./video/webav1.mp4', './img/bunny.png'];
    const { loadStream } = playOutputStream(resList, playerContiner);

    const spr1 = new OffscreenSprite(
      new MP4Clip((await fetch(resList[0])).body!),
    );

    const spr2 = new OffscreenSprite(
      new ImgClip(
        await renderTxt2ImgBitmap(
          '水印',
          `font-size:40px; color: white; text-shadow: 2px 2px 6px red;`,
        ),
      ),
    );
    spr2.time = { offset: 0, duration: 5e6 };
    spr2.setAnimation(
      {
        '0%': { x: 0, y: 0 },
        '25%': { x: 1200, y: 680 },
        '50%': { x: 1200, y: 0 },
        '75%': { x: 0, y: 680 },
        '100%': { x: 0, y: 0 },
      },
      { duration: 4, iterCount: 1 },
    );
    spr2.zIndex = 10;
    spr2.opacity = 0.5;

    const spr3 = new OffscreenSprite(
      new ImgClip(
        await createImageBitmap(await (await fetch(resList[1])).blob()),
      ),
    );
    // 初始旋转 180°
    spr3.rect.angle = Math.PI;
    spr3.setAnimation(
      {
        from: { angle: Math.PI, x: 0, y: 0, opacity: 1 },
        to: { angle: Math.PI * 2, x: 300, y: 300, opacity: 0 },
      },
      { duration: 3 },
    );

    const com = new Combinator({
      width: 1280,
      height: 720,
      videoCodec: 'avc1.42E032',
      bgColor: 'white',
    });

    await com.add(spr1, { main: true });
    await com.add(spr2);
    await com.add(spr3);

    await loadStream(com.output(), com);
  })().catch(Log.error);
});

document.querySelector('#mp4-mp3')?.addEventListener('click', () => {
  (async () => {
    const resList = ['./video/bunny_0.mp4', './audio/44.1kHz-2chan.mp3'];
    const { loadStream } = playOutputStream(resList, playerContiner);

    const resp1 = await fetch(resList[0]);
    const mp4Clip = new MP4Clip(resp1.body!);
    await mp4Clip.ready;
    // mp4Clip.deleteRange(10e6, 15e6);
    const spr1 = new OffscreenSprite(mp4Clip);
    await spr1.ready;
    spr1.rect.w = 1280;
    spr1.rect.h = 720;

    const resp2 = await fetch(resList[1]);
    const spr2 = new OffscreenSprite(
      new AudioClip(resp2.body!, {
        // volume: 2,
        loop: true,
      }),
    );
    const com = new Combinator({
      width: 1280,
      height: 720,
    });
    await com.add(spr1, { main: true });
    await com.add(spr2);

    await loadStream(com.output(), com);
  })().catch(Log.error);
});

document.querySelector('#mix-audio')?.addEventListener('click', () => {
  (async () => {
    const resList = ['./audio/44.1kHz-2chan.m4a', './audio/16kHz-1chan.mp3'];
    const { loadStream } = playOutputStream(resList, playerContiner, 'audio');

    const resp1 = await fetch(resList[0]);
    const resp2 = await fetch(resList[1]);
    const spr1 = new OffscreenSprite(
      new AudioClip(resp1.body!, { volume: 0.5 }),
    );
    spr1.time = { offset: 0, duration: 5e6 };
    const spr2 = new OffscreenSprite(new AudioClip(resp2.body!));
    spr2.time = { offset: 0, duration: 4e6 };

    const com = new Combinator({});
    await com.add(spr1);
    await com.add(spr2);

    await loadStream(com.output(), com);
  })().catch(Log.error);
});

document.querySelector('#concat-audio')?.addEventListener('click', () => {
  (async () => {
    const resList = ['./audio/16kHz-1chan.mp3', './audio/44.1kHz-2chan.m4a'];
    const { loadStream } = playOutputStream(resList, playerContiner);

    const clip = await concatAudioClip(
      await Promise.all(
        resList.map(async (url) => new AudioClip((await fetch(url)).body!)),
      ),
    );
    const spr1 = new OffscreenSprite(clip);
    spr1.time = { offset: 0, duration: 30e6 };

    const com = new Combinator({ width: 1280, height: 720 });
    await com.add(spr1);

    await loadStream(com.output(), com);
  })().catch(Log.error);
});

document.querySelector('#gif-m4a')?.addEventListener('click', () => {
  (async () => {
    const resList = ['./img/animated.gif', './audio/44.1kHz-2chan.m4a'];
    const { loadStream } = playOutputStream(resList, playerContiner);

    const resp1 = await fetch(resList[0]);
    const spr1 = new OffscreenSprite(
      new ImgClip({ type: 'image/gif', stream: resp1.body! }),
    );
    const resp2 = await fetch(resList[1]);
    const spr2 = new OffscreenSprite(new AudioClip(resp2.body!));
    const com = new Combinator({ width: 1280, height: 720 });
    spr1.time = { duration: 10e6, offset: 0 };
    spr2.time = { duration: 10e6, offset: 0 };
    await com.add(spr1);
    await com.add(spr2);

    await loadStream(com.output(), com);
  })();
});

document.querySelector('#mp4-srt')?.addEventListener('click', () => {
  (async () => {
    const resList = ['./video/webav1.mp4', './subtitles/test-sample.srt'];
    const { loadStream } = playOutputStream(resList, playerContiner);

    const resp1 = await fetch(resList[0]);
    const spr1 = new OffscreenSprite(new MP4Clip(resp1.body!));
    const resp2 = await fetch(resList[1]);
    const spr2 = new OffscreenSprite(
      new EmbedSubtitlesClip(await resp2.text(), {
        videoWidth: 1280,
        videoHeight: 720,
        fontSize: 44,
        fontFamily: 'Noto Sans SC',
        strokeStyle: '#000',
        lineWidth: 20,
        lineJoin: 'round',
        lineCap: 'round',
        textShadow: {
          offsetX: 2,
          offsetY: 2,
          blur: 4,
          color: 'rgba(0,0,0,0.25)',
        },
      }),
    );
    const com = new Combinator({ width: 1280, height: 720 });
    spr1.time = { duration: 10e6, offset: 0 };
    spr2.time = { duration: 10e6, offset: 0 };
    await com.add(spr1);
    await com.add(spr2);

    await loadStream(com.output(), com);
  })();
});

document.querySelector('#mp4-chromakey')?.addEventListener('click', () => {
  (async () => {
    const resList = ['./video/chromakey-test.mp4', './img/bunny.png'];
    const { loadStream } = playOutputStream(resList, playerContiner);

    const width = 1280;
    const height = 720;

    const chromakey = createChromakey({
      similarity: 0.4,
      smoothness: 0.1,
      spill: 0.1,
    });
    const originSpr = new OffscreenSprite(
      new MP4Clip((await fetch(resList[0])).body!),
    );
    await originSpr.ready;
    originSpr.zIndex = 1;
    originSpr.rect.x = (width - originSpr.rect.w * 2 - 100) / 2;
    originSpr.rect.y = (height - originSpr.rect.h) / 2;

    const targetClip = new MP4Clip((await fetch(resList[0])).body!);
    targetClip.tickInterceptor = async (_, tickRet) => {
      if (tickRet.video == null) return tickRet;
      return {
        ...tickRet,
        video: await chromakey(tickRet.video),
      };
    };

    const targetSpr = new OffscreenSprite(targetClip);
    await targetSpr.ready;
    targetSpr.zIndex = 1;
    targetSpr.rect.x = originSpr.rect.x + targetSpr.rect.w + 100;
    targetSpr.rect.y = (height - targetSpr.rect.h) / 2;

    const bgImgSpr = new OffscreenSprite(
      new ImgClip(
        await createImageBitmap(await (await fetch(resList[1])).blob()),
      ),
    );

    const com = new Combinator({
      width,
      height,
      bgColor: 'white',
    });

    await com.add(originSpr, { main: true });
    await com.add(targetSpr);
    await com.add(bgImgSpr);

    await loadStream(com.output(), com);
  })().catch(Log.error);
});

document.querySelector('#complex')?.addEventListener('click', () => {
  (async () => {
    const mp4List = ['./video/123.mp4', './video/223.mp4', './video/323.mp4'];

    const width = 1280;
    const height = 720;

    const chromakey = createChromakey({
      similarity: 0.4,
      smoothness: 0.1,
      spill: 0.1,
    });

    // Remove background, add bunny as new background, composite video
    const coms = (
      await Promise.all(mp4List.map(async (vurl) => (await fetch(vurl)).body!))
    )
      .map((sbody) => {
        const clip = new MP4Clip(sbody);
        clip.tickInterceptor = async (_, tickRet) => {
          // console.log(2222, _, tickRet)
          if (tickRet.video == null) return tickRet;
          return {
            ...tickRet,
            video: await chromakey(tickRet.video),
          };
        };
        return clip;
      })
      .map((clip) => new OffscreenSprite(clip))
      .map(async (spr, idx) => {
        const com = new Combinator({ width, height });
        const imgSpr = new OffscreenSprite(
          new ImgClip(
            await createImageBitmap(
              await (await fetch('./img/bunny.png')).blob(),
            ),
          ),
        );
        await spr.ready;
        spr.rect.x = idx * spr.rect.w;
        await com.add(imgSpr);
        await com.add(spr, { main: true });
        return com.output();
      });

    const { loadStream } = playOutputStream(mp4List, playerContiner);

    // then concat multiple videos
    await loadStream(await fastConcatMP4(await Promise.all(coms)));
  })().catch(Log.error);
});
