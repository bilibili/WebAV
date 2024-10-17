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
