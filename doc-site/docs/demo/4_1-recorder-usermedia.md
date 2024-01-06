---
nav: DEMO
group:
  title: 视频录制
  order: 4

order: 1
---

# 录制摄像头

录制摄像头，输出 MP4（AVC, AAC）实时视频流，视频流可以写入本地文件，或上传到服务器。

下面示例演示将流写入本地文件，录制过程中流式写入数据，所以一开始就需要创建一个本地文件。  
将 `recorder.outputStream` 数据上传到服务器，即可实现推送实时流数据。

```tsx
import React, { useState, useRef, useEffect } from 'react';
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

  useEffect(() => {
    return () => {
      recorder?.stop();
    };
  }, []);

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

## 修复输出文件不显示时长

实时视频流不能确定结束时间，所以会缺失**总时长**字段，大部分播放器能分析 Sample 显示正确的总时长；  
但某些兼容性较差的播放器（Windows Media Player）无法显示时长信息。

`mp4StreamToOPFSFile` 可以将内容保存到一个 [OPFS][1] File 对象中，在视频流结束时添加总时长字段；  
因为需要在流结束的时候去修正时长信息，所以无法在录制过程中实时上传数据。

```ts
const opfsFile = await mp4StreamToOPFSFile(recorder.outputStream);
```

以下是完整的示例代码，与上一个示例的差异在于：  
视频数据临时保存在 File 对象中，在录制结束时修正了时长（duration）字段，所以在点击 **Stop** 时才需要创建本地文件。

```tsx
import React, { useState, useRef, useEffect } from 'react';
import { Button, Divider } from 'antd';
import { AVRecorder } from '@webav/av-recorder';
import { mp4StreamToOPFSFile } from '@webav/av-cliper';

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

  const opfsFile = await mp4StreamToOPFSFile(recorder.outputStream);

  const fileHandle = await window.showSaveFilePicker({
    suggestedName: `WebAV-${Date.now()}.mp4`,
  });
  const writer = await fileHandle.createWritable();
  writer.write(opfsFile);
  writer.close();
}

export default function UI() {
  const [btnState, setBtnState] = useState(0);
  const videoRef = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    return () => {
      recorder?.stop();
    };
  }, []);

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

[1]: https://developer.mozilla.org/en-US/docs/Web/API/File_System_API/Origin_private_file_system
