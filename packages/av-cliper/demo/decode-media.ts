import { Log, Combinator } from '../src';
import { decodeImg, sleep } from '../src/av-utils';
import { createChromakey } from '../src/chromakey';
import { AudioClip, DEFAULT_AUDIO_CONF, MP4Clip } from '../src/clips';
import { EmbedSubtitlesClip } from '../src/clips/embed-subtitles-clip';

// decode with webworker
// import Worker from './decode-video-worker?worker&inline';
// new Worker();

(async () => {
  if (!(await Combinator.isSupported())) {
    alert('Your browser does not support WebCodecs');
  }
})();

const cvs = document.querySelector('canvas') as HTMLCanvasElement;
const ctx = cvs.getContext('2d')!;

const imgs = {
  'image/avif': './img/animated.avif',
  'image/webp': './img/animated.webp',
  'image/png': './img/animated.png',
  'image/gif': './img/animated.gif',
};

let stopImg = () => {};
document.querySelector('#decode-img')?.addEventListener('click', () => {
  (async () => {
    stopImg();
    const imgType = (
      document.querySelector('input[name=img-type]:checked') as HTMLInputElement
    ).value;

    // @ts-expect-error
    const resp1 = await fetch(imgs[imgType]);
    const frames = await decodeImg(resp1.body!, imgType);

    let i = 0;
    function render(vf: VideoFrame) {
      if (vf == null) return;
      ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
      ctx.drawImage(vf, 0, 0);
      const timer = setTimeout(
        () => {
          render(frames[++i]);
        },
        (vf.duration ?? 0) / 1000,
      );
      stopImg = () => {
        clearTimeout(timer);
      };
    }
    render(frames[0]);
  })();
});

const audios = {
  '44.1kHz-2chan.m4a': './audio/44.1kHz-2chan.m4a',
  '44.1kHz-2chan.mp3': './audio/44.1kHz-2chan.mp3',
  '16kHz-1chan.mp3': './audio/16kHz-1chan.mp3',
};

let stopAudio = () => {};
document.querySelector('#decode-audio')?.addEventListener('click', () => {
  (async () => {
    stopAudio();
    const audioType = (
      document.querySelector(
        'input[name=audio-type]:checked',
      ) as HTMLInputElement
    ).value;
    // @ts-expect-error
    const resp1 = await fetch(audios[audioType]);
    const clip = new AudioClip(resp1.body!);
    await clip.ready;
    const ctx = new AudioContext();
    let time = 0;
    // 当前片段的开始播放的时间
    let startAt = 0;
    async function play() {
      time += 100000;
      const { audio, state } = await clip.tick(time);
      if (state === 'done') {
        console.log('--- ended');
        return;
      }
      const len = audio[0].length;
      if (len === 0) {
        play();
        return;
      }

      const buf = ctx.createBuffer(2, len, DEFAULT_AUDIO_CONF.sampleRate);
      buf.copyToChannel(audio[0], 0);
      buf.copyToChannel(audio[1], 1);
      const source = ctx.createBufferSource();
      source.buffer = buf;
      source.connect(ctx.destination);
      startAt = Math.max(ctx.currentTime, startAt);
      source.start(startAt);

      startAt += buf.duration;

      play();
    }
    play();

    stopAudio = () => {
      ctx.close();
    };
  })();
});

const videos = {
  'bunny.mp4': './video/bunny_0.mp4',
  'bear.mp4': './video/bear-vp9.mp4',
};
document.querySelector('#decode-video')?.addEventListener('click', () => {
  (async () => {
    const videoType = (
      document.querySelector(
        'input[name=video-type]:checked',
      ) as HTMLInputElement
    ).value;
    const speed = document.querySelector(
      'input[name=playrate]:checked',
    ) as HTMLInputElement;

    // @ts-expect-error
    const resp1 = await fetch(videos[videoType]);
    const clip = new MP4Clip(resp1.body!);
    await clip.ready;

    if (speed.value === 'fastest') {
      fastestDecode();
    } else {
      timesSpeedDecode(Number(speed.value));
    }

    async function fastestDecode() {
      let time = 0;
      while (true) {
        const { state, video } = await clip.tick(time);
        if (state === 'done') break;
        if (video != null && state === 'success') {
          ctx.clearRect(0, 0, cvs.width, cvs.height);
          ctx.drawImage(video, 0, 0, video.codedWidth, video.codedHeight);
          video.close();
        }
        time += 33000;
      }
      clip.destroy();
    }

    function timesSpeedDecode(times: number) {
      let startTime = performance.now();

      const timer = setInterval(async () => {
        const { state, video } = await clip.tick(
          Math.round((performance.now() - startTime) * 1000) * times,
        );
        if (state === 'done') {
          clearInterval(timer);
          clip.destroy();
          return;
        }
        if (video != null && state === 'success') {
          ctx.clearRect(0, 0, cvs.width, cvs.height);
          ctx.drawImage(video, 0, 0, video.codedWidth, video.codedHeight);
          video.close();
        }
      }, 1000 / 30);
    }
  })().catch(Log.error);
});

const subtitles = {
  'test-sample.srt': './subtitles/test-sample.srt',
};
document.querySelector('#decode-subtitles')?.addEventListener('click', () => {
  (async () => {
    stopImg();
    const subtitlesType = (
      document.querySelector(
        'input[name=subtitles-type]:checked',
      ) as HTMLInputElement
    ).value;

    // @ts-expect-error
    const resp1 = await fetch(subtitles[subtitlesType]);

    const es = new EmbedSubtitlesClip(await resp1.text(), {
      videoWidth: 1280,
      videoHeight: 720,
      fontSize: 40,
      // textBgColor: '#000000',
      color: 'yellow',
    });

    let time = 0;
    while (time < 20 * 1e6) {
      const { state, video } = await es.tick(time);
      if (state === 'done') break;
      ctx.clearRect(0, 0, cvs.width, cvs.height);
      ctx.drawImage(video!, 0, 0);
      video?.close();
      time += 33000;
      await sleep(10);
    }
    console.log('decode subtitles done');
    es.destroy();
  })();
});

document.querySelector('#chromakey')?.addEventListener('click', () => {
  (async () => {
    const clip = new MP4Clip((await fetch('./video/chromakey-test.mp4')).body!);
    const chromakey = createChromakey({
      similarity: 0.4,
      smoothness: 0.1,
      spill: 0.1,
    });
    clip.tickInterceptor = async (_, tickRet) => {
      if (tickRet.video == null) return tickRet;
      return {
        ...tickRet,
        video: await chromakey(tickRet.video),
      };
    };
    let time = 0;
    const timerId = setInterval(async () => {
      const { state, video } = await clip.tick(time);
      if (state === 'done') {
        clearInterval(timerId);
        clip.destroy();
      }
      if (video != null && state === 'success') {
        ctx.clearRect(0, 0, cvs.width, cvs.height);
        ctx.drawImage(video, 0, 0, video.codedWidth, video.codedHeight);
        video.close();
      }
      time += 33000;
    }, 33.33);
  })().catch(Log.error);
});
