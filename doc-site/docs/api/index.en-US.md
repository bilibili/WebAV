---
nav:
  title: API
  order: 3
sidebar: false
---

The WebAV project contains three modules that generate API documentation using TypeDoc.

- [@webav/av-cliper](//webav-tech.github.io/WebAV/_api/av-cliper/)
  - Provides a basic API for audio and video data processing.
  - Include: audio and video decoding, synthesis, stitching, cropping and other functions.
- [@webav/av-recorder](//webav-tech.github.io/WebAV/_api/av-recorder/)
  - Record a `MediaStream` and output MP4 video.
  - In the browser, the `MediaStream` object is available from the canvas, video, camera, microphone, Share Screen apis, etc.
- [@webav/av-canvas](//webav-tech.github.io/WebAV/_api/av-canvas/)
  - A "canvas" that the user or code can manipulate, add and control assets, and output a `MediaStream`.
  - Materials include: camera, microphone, screen, audio and video files, images, text.
  - Outputting `MediaStream` means being able to push "canvas" content to a server or record it as a local video.

`@webav/av-cliper` has a more API, Suggest to read [basic concepts](https://webav-tech.github.io/WebAV/_api/av-cliper/#md:basic-concepts-%E5%9F%BA%E7%A1%80%E6%A6%82%E5%BF%B5) Helpful to quickly understand the DEMO source code and other apis.
