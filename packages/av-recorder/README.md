# AVRecorder

Record MediaStream to mp4, Use Webcodecs API encode VideoFrame and AudioData, [mp4box.js](https://github.com/gpac/mp4box.js) as muxer.

## Example
Record camera & microphone, save data to mp4 file.

```ts
import { AVRecorder } from '@webav/av-recorder'

const mediaStream = await navigator.mediaDevices.getUserMedia({
  video: true,
  audio: true
})

const recorder = new AVRecorder(mediaStream, {
  width: 1280,
  height: 720,
  // aac or opus (default)
  audioCodec: 'aac'
})
await recorder.start()

const fileHandle = await window.showSaveFilePicker({
  suggestedName: `av-recorder.mp4`
})

recorder.outputStream
  .pipeTo(await fileHandle.createWritable())


// await recorder.stop()
```
