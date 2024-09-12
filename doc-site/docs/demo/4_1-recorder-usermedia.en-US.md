---
nav: DEMO
group:
  title: record video

order: 4
---

# Camera

Recording camera, output MP4 (AVC, AAC) real-time video stream, video stream can be written to a local file, or uploaded to the server.

The following example shows how to stream to a local file.The stream writes data during the recording process, so you'll need to create a local file to start with.

```tsx
import React, { useState, useRef, useEffect } from 'react';
import { Button, Divider } from 'antd';
import { AVRecorder } from '@webav/av-recorder';
import { createFileWriter } from './utils';

let recorder: AVRecorder | null = null;
async function start(videoEl: HTMLVideoElement) {
  const mediaStream = await navigator.mediaDevices.getUserMedia({
    video: true,
    audio: true,
  });
  const recodeMS = mediaStream.clone();
  videoEl.srcObject = mediaStream;
  videoEl.play().catch(console.error);

  recorder = new AVRecorder(recodeMS);

  recorder
    .start()
    .pipeTo(await createFileWriter())
    .catch(console.error);
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

## Fixed output file not showing duration

Live video streams can't determine the end time, so the **total duration** field is missing. Most players can analyze the Sample and display the correct total duration;

However, some less compatible players (Windows Media Player) are unable to display duration information.

`fixFMP4Duration` temporarily saves the content to an [OPFS][1], adding the total duration field at the end of the video stream;

Because the duration information needs to be corrected at the end of the stream, it is not possible to upload the data in real time during the recording.

```ts
const outStream = await fixFMP4Duration(recorder.start());
```

Here is the complete example code, with the differences from the previous example:

The video data is temporarily saved in OPFS, and the duration field is fixed at the end of the recording, so the local file is only created when **Stop** is clicked.

```tsx
import React, { useState, useRef, useEffect } from 'react';
import { Button, Divider } from 'antd';
import { AVRecorder } from '@webav/av-recorder';
import { fixFMP4Duration } from '@webav/av-cliper';
import { createFileWriter } from './utils';

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

  (await fixFMP4Duration(recorder.start()))
    .pipeTo(await createFileWriter())
    .catch(console.error);
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
