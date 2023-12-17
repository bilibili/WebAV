---
nav: DEMO
group:
  title: 合成

order: 6
---

# 自定义资源

使用 canvas 实现一个倒计时 Clip，快速生成视频文件；  
基于同样原理，适应于需要将 canvas 内容（比如 动画）**快速**保存为视频文件的场景。

:::info
最重要的是：需要知道**任意时刻** canvas 应该绘制什么内容。
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
      // 单位 微秒
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
    // 最重要的是需要知道**某一时刻**应该绘制什么内容
    // 倒计时总时长 - 当前时刻  就是需要绘制的内容
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

  destroy() {
    this.#cvsEl.remove();
  }
}

async function start() {
  const spr = new OffscreenSprite('spr', new CountdownClip(5));

  const com = new Combinator({ width: WIDTH, height: HEIGHT });
  await com.add(spr, { main: true });
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
