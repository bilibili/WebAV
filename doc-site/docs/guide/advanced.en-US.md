---
nav:
  title: 指南
  order: 2
group:
  title: Start
order: 4
---

# Advanced

WebAV offers two ways to extend its capabilities to support diverse business scenarios.

## Interceptors (Frame-by-frame processing)

If you need to process video frame-by-frame, such as adding filters, beauty effects, or removing green screens from virtual avatars, you can use the `tickInterceptor` method provided by `MP4Clip`. Refer to the [tickInterceptor API documentation](https://webav-tech.github.io/WebAV/_api/av-cliper/classes/MP4Clip.html#tickInterceptor) for more details.

Check out the [DEMO on removing green screen backgrounds](https://webav-tech.github.io/WebAV/demo/3_2-chromakey-video) to understand how to use the API.

The `tickInterceptor` can also process audio data, enabling real-time voice changing, speed adjustment, vocal enhancement, and more.

## Custom Assets

If you want to combine **images and audio data** from third-party sources (canvas, pixi.js) or programmatically generated content into a video file, or apply complex control logic to existing assets, you can use custom assets to achieve this.

The official [DEMO on merging programmatically generated countdown images from canvas into a video](https://webav-tech.github.io/WebAV/demo/2_6-custom-clip) explains how to use this functionality.
