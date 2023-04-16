# AVCanvas

Combine Text, Image, Video, Audio, UserMedia, DisplayMedia to generate MediaStream.  
With [AVRcorder](../av-recorder/README.md) you can output MP4 streams and save them as local files or push them to the server.  

使用文字、图片、音视频文件、摄像头&麦克风、分享屏幕来生成 MediaStream。  
配合 [AVRcorder](../av-recorder/README.md) 可以输出 MP4 流，然后保存为本地文件或推送至服务器。  

## Example
Record a video tutorial, add camera, micphone and screen to the canvas, then export mp4 and save as mp4 file.  
录制视频教程，在画布中添加 camera、micphone 和屏幕，然后导出mp4保存为mp4文件。  

```ts
import { AVCanvas, VideoSprite } from '@webav/av-canvas'
import { AVRecorder } from '@webav/av-recorder'

const avCvs = new AVCanvas(document.querySelector('#app') as HTMLElement, {
  bgColor: '#333',
  resolution: {
    width: 1920,
    height: 1080
  }
})

const userMediaStream = await navigator.mediaDevices.getUserMedia({
  video: true,
  audio: true
})
const userSprite = new VideoSprite('userMedia', userMediaStream, {
  audioCtx: avCvs.spriteManager.audioCtx
})
await avCvs.spriteManager.addSprite(userSprite)

const screenStream = await navigator.mediaDevices.getDisplayMedia({
  video: true,
  audio: true
})
const screenSprite = new VideoSprite('screen', screenStream, {
  audioCtx: avCvs.spriteManager.audioCtx
})
await avCvs.spriteManager.addSprite(screenSprite)


//  start event
const recorder = new AVRecorder(avCvs.captureStream(), {
  width: 1280,
  height: 720,
  audioCodec: 'aac'
})
await recorder.start()

const fileHandle = await window.showSaveFilePicker({
  suggestedName: 'tutorial.mp4'
})
recorder.outputStream
  .pipeTo(fileHandle.createWritable())

// stop event
recorder.stop()
```

## Demo
[Demo code](demo/demo.ts)  