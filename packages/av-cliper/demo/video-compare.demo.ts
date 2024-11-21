import { MP4Clip } from '../src/clips/mp4-clip';

const toggleCanvasBtnA = document.querySelector(
  '#toggle-canvas-a',
) as HTMLButtonElement;
toggleCanvasBtnA.addEventListener('click', function () {
  const canvasContainerA = document.querySelector(
    '#canvas-container-a',
  ) as HTMLDivElement;
  canvasContainerA.style.display =
    canvasContainerA.style.display === 'none' ? 'block' : 'none';
});

(async () => {
  const clipA = new MP4Clip((await fetch('./video/pri-video-A.mp4')).body!);
  await clipA.ready;
  const playerA = new MP4Player('./video/pri-video-A.mp4');
  await playerA.ready;
  document.querySelector('#canvas-container-a')!.appendChild(playerA.canvas);

  const playerB = new MP4Player('./video/pri-video-B.mp4');
  await playerB.ready;
  document.querySelector('#canvas-container-b')!.appendChild(playerB.canvas);

  const nextFrameBtnA = document.querySelector(
    '#next-frame-a',
  ) as HTMLButtonElement;
  nextFrameBtnA.addEventListener('click', function () {
    playerA.nextFrame();
  });

  const nextFrameBtnB = document.querySelector(
    '#next-frame-b',
  ) as HTMLButtonElement;
  nextFrameBtnB.addEventListener('click', function () {
    playerB.nextFrame();
  });
})();

class MP4Player {
  #clip: MP4Clip | null = null;
  #cvs = document.createElement('canvas');

  get canvas() {
    return this.#cvs;
  }

  #ctx = this.#cvs.getContext('2d', { colorSpace: 'display-p3' })!;

  #ready: Promise<void>;
  get ready() {
    return this.#ready;
  }

  constructor(src: string) {
    this.#ready = this.#init(src);
  }

  async #init(src: string) {
    this.#clip = new MP4Clip((await fetch(src)).body!);
    const meta = await this.#clip.ready;
    this.#cvs.width = meta.width;
    this.#cvs.height = meta.height;
    await this.nextFrame();
  }

  #renderFrame(vf: VideoFrame) {
    this.#ctx.drawImage(
      vf,
      0,
      0,
      vf.displayWidth,
      vf.displayHeight,
      0,
      0,
      this.#cvs.width,
      this.#cvs.height,
    );
    vf.close();
  }

  #currentTs = 0;

  #timer = 0;
  async play() {
    clearInterval(this.#timer);
    await this.#ready;
    // todo: 使用 performance.now() 代替，避免累计时间误差
    const step = 1 / 30;
    this.#timer = window.setInterval(async () => {
      if (this.#clip == null) return;
      const { video, state } = await this.#clip.tick(this.#currentTs);
      this.#currentTs += step * 1e6;
      if (state === 'done') {
        clearInterval(this.#timer);
        return;
      }
      if (video == null) return;
      this.#renderFrame(video);
    }, step * 1e3);
  }

  pause() {
    clearInterval(this.#timer);
  }

  seek(ts: number) {
    this.#currentTs = ts;
  }

  async nextFrame() {
    clearInterval(this.#timer);
    if (this.#clip == null) return;
    while (true) {
      this.#currentTs += 10e3;
      const { video, state } = await this.#clip.tick(this.#currentTs);
      if (state === 'done') break;
      if (video == null) continue;
      this.#currentTs = Math.max(video.timestamp, this.#currentTs);
      this.#renderFrame(video);
      break;
    }
  }

  prevFrame() {}
}
