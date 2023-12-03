---
nav: DEMO
group:
  title: 视频录制
  order: 4

order: 1
---

# 录制摄像头

录制摄像头，输出 MP4（AVC, AAC）视频文件；  
录制过程中流式写入数据就，所以一开始就需要创建一个本地文件。

```tsx
import React, { useState, useRef } from 'react';
import { Button, Divider } from 'antd';
import { AVRecorder } from '@webav/av-recorder';

let recorder: AVRecorder | null = null;
async function start(videoEl: HTMLVideoElement) {
  const mediaStream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true,
  });
  const recodeMS = mediaStream.clone();
  videoEl.srcObject = mediaStream;
  videoEl.play().catch(console.error);

  recorder = new AVRecorder(recodeMS, {
    width: 1280,
    height: 720,
  });
  await recorder.start();

  const fileHandle = await window.showSaveFilePicker({
    suggestedName: `WebAV-${Date.now()}.mp4`,
  });
  const writer = await fileHandle.createWritable();
  recorder.outputStream?.pipeTo(writer).catch(console.error);
}

export default function UI() {
  const [btnState, setBtnState] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);
  return (
    <>
      <Button
        type={btnState === 0 ? 'primary' : 'default'}
        onClick={() => {
          if (btnState === 0 && videoRef.current != null) {
            setBtnState(1);
            start(videoRef.current);
          }
          if (btnState === 1) {
            setBtnState(2);
            recorder?.pause();
          }
          if (btnState === 2) {
            setBtnState(1);
            recorder?.resume();
          }
        }}
      >
        {['Start', 'Pause', 'Resume'][btnState]}
      </Button>
      <Divider type="vertical"></Divider>{' '}
      <Button
        danger
        onClick={() => {
          setBtnState(0);
          recorder?.stop();
          if (videoRef.current?.srcObject instanceof MediaStream) {
            videoRef.current.srcObject.getTracks().forEach((track) => {
              track.stop();
            });
            videoRef.current.srcObject = null;
          }
        }}
      >
        Stop
      </Button>
      <br />
      <video ref={videoRef} muted style={{ width: 600, height: 333 }}></video>
    </>
  );
}
```
