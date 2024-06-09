import { VisibleSprite, MediaStreamClip } from '@webav/av-cliper';
import { AVCanvas } from '../src/index';
import { AVRecorder } from '@webav/av-recorder';

const avCvs = new AVCanvas(document.querySelector('#app') as HTMLElement, {
  bgColor: '#333',
  width: 1920,
  height: 1080,
});
avCvs.play({ start: 0, end: Infinity });
avCvs.on('timeupdate', (t) => {
  // console.log(1111, t);
});

(async (): Promise<void> => {
  // const is = new ImgSprite('img', 'https://neo-pages.bilibili.com/bbfe/neo/assets/img/neo-pages-overview.48f7bb81.png')
  // await avCvs.spriteManager.addSprite(is)
})().catch(console.error);
document.querySelector('#userMedia')?.addEventListener('click', () => {
  (async () => {
    const spr = new VisibleSprite(
      new MediaStreamClip(
        await navigator.mediaDevices.getUserMedia({
          video: true,
          audio: true,
        }),
      ),
    );
    await avCvs.addSprite(spr);
  })().catch(console.error);
});

document.querySelector('#display')?.addEventListener('click', () => {
  // (async () => {
  //   const mediaStream = await navigator.mediaDevices.getDisplayMedia({
  //     video: true,
  //     audio: true,
  //   });
  //   const vs = new VideoSprite('display', mediaStream, {
  //     audioCtx: avCvs.spriteManager.audioCtx,
  //   });
  //   await avCvs.spriteManager.addSprite(vs);
  // })().catch(console.error);
});

document.querySelector('#localImg')?.addEventListener('click', () => {
  // (async () => {
  //   const [imgFH] = await (window as any).showOpenFilePicker({
  //     types: [
  //       {
  //         description: 'Images',
  //         accept: {
  //           'image/*': ['.png', '.gif', '.jpeg', '.jpg'],
  //         },
  //       },
  //     ],
  //   });
  //   const is = new ImgSprite('img', await imgFH.getFile());
  //   await avCvs.spriteManager.addSprite(is);
  // })().catch(console.error);
});

document.querySelector('#localVideo')?.addEventListener('click', () => {
  // (async () => {
  //   const [imgFH] = await (window as any).showOpenFilePicker({
  //     types: [
  //       {
  //         description: 'Video',
  //         accept: {
  //           'video/*': ['.webm', '.mp4'],
  //         },
  //       },
  //     ],
  //   });
  //   const vs = new VideoSprite('vs', await imgFH.getFile(), {
  //     audioCtx: avCvs.spriteManager.audioCtx,
  //   });
  //   await avCvs.spriteManager.addSprite(vs);
  // })().catch(console.error);
});

document.querySelector('#localAudio')?.addEventListener('click', () => {
  // (async () => {
  //   const [imgFH] = await (window as any).showOpenFilePicker({
  //     types: [
  //       {
  //         description: 'Audio',
  //         accept: {
  //           'audio/*': ['.mp3', '.wav', '.ogg'],
  //         },
  //       },
  //     ],
  //   });
  //   const as = new AudioSprite('vs', await imgFH.getFile(), {
  //     audioCtx: avCvs.spriteManager.audioCtx,
  //   });
  //   await avCvs.spriteManager.addSprite(as);
  // })().catch(console.error);
});

document.querySelector('#fontExamp')?.addEventListener('click', () => {
  // (async () => {
  //   const textSpr = new TextSprite('text', '示例文字');
  //   await avCvs.spriteManager.addSprite(textSpr);
  // })().catch(console.error);
});

let recorder: AVRecorder | null = null;
document.querySelector('#startRecod')?.addEventListener('click', () => {
  (async () => {
    const writer = await createFileWriter('mp4');
    recorder = new AVRecorder(avCvs.captureStream(), {
      bitrate: 5e6,
    });
    recorder.start().pipeTo(writer).catch(console.error);
  })().catch(console.error);
});
document.querySelector('#stopRecod')?.addEventListener('click', () => {
  (async () => {
    await recorder?.stop();
    alert('save done');
  })().catch(console.error);
});

async function createFileWriter(
  extName: string,
): Promise<FileSystemWritableFileStream> {
  const fileHandle = await window.showSaveFilePicker({
    suggestedName: `WebAV-export-${Date.now()}.${extName}`,
  });
  return fileHandle.createWritable();
}

export {};
