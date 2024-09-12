---
nav: DEMO
group:
  title: record video
  order: 4

order: 1
---

# Live Recording

`AVCanvas` allows users to add various assets and drag them to change their position, which is very easy to integrate into the **live streaming** workbench.

v0.10 adds support for `MediaStreamClip` to enhance live streaming scenarios, such as sharing desktop, playing audio and video resources, camera/microphone, connecting with other streamers (even MAC), etc.

`AVCanvas.captureStream()` composits the image and audio of all assets and returns a `MediaStream` that can be used to push the WebRTC Stream.

`AVRecorder` can be used to record a `MediaStream` and the resulting MP4 file stream (`ReadableStream`) can be saved locally, uploaded to a server, or used for WebSocket streaming.

<code src="./recorder-avcanvas.tsx"></code>

:::info
DEMO does not implement UI such as deleting assets, changing asset level, etc. The API provides such basic capabilities.
:::

:::info
`MediaStreamClip` is a **live stream**, so it can't be used ina Combinator to **speed up** composable video.
:::
