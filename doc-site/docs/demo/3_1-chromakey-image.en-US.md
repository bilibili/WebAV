---
nav: DEMO
group:
  title: Green screen matting
  order: 5

order: 1
---

# Image Background

```tsx
import React, { useEffect, useState } from 'react';
import { createChromakey } from '@webav/av-cliper';
import { assetsPrefix } from './utils';

const imgSrc = assetsPrefix(['img/green-dog.jpeg']);

const chromakey = createChromakey({
  // Unset keyColor defaults to the color of the first pixel in the top-left corner
  // keyColor: '#00FF00'
  similarity: 0.4,
  smoothness: 0.05,
  spill: 0.05,
});

async function start(ctx: CanvasRenderingContext2D) {
  const img = new Image();
  img.src = imgSrc[0];
  await new Promise((resolve) => {
    img.onload = resolve;
  });
  ctx.drawImage(
    await chromakey(img),
    0,
    0,
    ctx.canvas.width,
    ctx.canvas.height,
  );
}

export default function UI() {
  const [ctx, setCtx] = useState<null | undefined | CanvasRenderingContext2D>();

  useEffect(() => {
    (async () => {
      if (ctx == null) return;
      start(ctx);
    })();
  }, [ctx]);

  return (
    <div>
      <div>origin image</div>
      <img src={imgSrc[0]} style={{ width: 500 }} />
      <div>remove background</div>
      <canvas
        width={500}
        height={280}
        ref={(c) => {
          setCtx(c?.getContext('2d'));
        }}
      />
    </div>
  );
}
```

Refer to the article for the principle of implementation：[WebGL Chromakey real-time green matting](https://hughfenghen.github.io/posts/2023/07/07/webgl-chromakey/)
