---
nav: DEMO
group:
  title: Composite
  order: 3

order: 1
---

# Video Composite

Overlaying one other material (image, text, video) on the video can be used to embed a watermark in the video, or to combine two video files.

**Here is an example of watermarking a video**

The idea is to draw an image (watermark) on top of the video and animate it.

`renderTxt2ImgBitmap` converts the watermarked text to an image because css makes it easy to implement complex text styling effects.

<code src="./2_1_1-watermark.tsx"></code>

:::warning
`renderTxt2ImgBitmap` depends on the DOM, so it cannot be used in WebWorkers.
:::

If you want to draw normal images ina video, you can create an `ImgClip` instance and add it to the `Combinator` as follows

```js
new ImgClip((await fetch('<img url>')).body);
```

If you want to overlay another video on top of the video, refer to the DEMO: `Green Matting - Video Background`
