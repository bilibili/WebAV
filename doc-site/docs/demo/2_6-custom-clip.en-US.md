---
nav: DEMO
group:
  title: Composite

order: 6
---

# Custom Assets

canvas was used to implement a countdown Clip to quickly generate video files.

Based on the same principle, it is suitable for situations where you need to save canvas content (like animations) **quickly** as a video file.

:::info
Most importantly: need to know what should be drawn on the canvas **at any given moment**.
:::

```tsx
import { Combinator, OffscreenSprite, IClip } from '@webav/av-cliper';
import { CombinatorPlay } from './combinator-player';
import React, { useState } from 'react';

const WIDTH = 1280;
const HEIGHT = 720;

class CountdownClip implements IClip {
  #cvsEl;
  #ctx;
  #duration;

  ready;

  constructor(duration: number) {
    this.#duration = duration;
    this.#cvsEl = document.createElement('canvas');
    this.#cvsEl.width = WIDTH;
    this.#cvsEl.height = HEIGHT;

    this.ready = Promise.resolve({
      width: WIDTH,
      height: HEIGHT,
      // Unit: microsecond
      duration: duration * 1e6,
    });

    this.#ctx = this.#cvsEl.getContext('2d')!;
    this.#ctx.font = `100px Noto Sans SC`;
  }

  async tick(time: number): Promise<{
    video?: VideoFrame;
    state: 'success' | 'done';
  }> {
    if (time > 1e6 * 10) return { state: 'done' };

    this.#ctx.fillStyle = '#333';
    this.#ctx.fillRect(0, 0, this.#cvsEl.width, this.#cvsEl.height);

    this.#ctx.fillStyle = '#FFF';
    // The most important thing is to know what should be drawn **at any given moment**
    // Countdown total time - the current moment is what needs to be drawn
    this.#ctx.fillText(
      String(Math.round((this.#duration * 1e6 - time) / 1000) / 1000),
      this.#cvsEl.width / 2 - 100,
      this.#cvsEl.height / 2,
    );

    return {
      state: 'success',
      video: new VideoFrame(this.#cvsEl, {
        timestamp: time,
      }),
    };
  }

  clone() {
    return new CountdownClip(this.#duration);
  }

  destroy() {
    this.#cvsEl.remove();
  }
}

async function start() {
  const spr = new OffscreenSprite(new CountdownClip(5));

  const com = new Combinator({ width: WIDTH, height: HEIGHT });
  await com.addSprite(spr, { main: true });
  return com;
}

export default function UI() {
  const [com, setCom] = useState<null | Combinator>(null);

  return (
    <CombinatorPlay
      list={[]}
      onStart={async () => setCom(await start())}
      com={com}
    ></CombinatorPlay>
  );
}
```
