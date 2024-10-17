---
nav: DEMO
group: decode
order: 3
---

# Gif Decoder

Gifs come in many formats, the oldest common being the `gif`;

A GIF is composed of multiple still image frames, which can be decoded using the browser API `ImageDecoder`;

Or use `ImgClip.tick(time)` to get an image frame at a specified time;

<code src="./1_3_1-decode-image.tsx"></code>

:::info
Note: `ImgClip.meta.duration = Infinity`, GIFs will loop over frames based on the time parameter by default.
:::
