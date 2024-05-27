import {
  AVCanvas,
  AudioSprite,
  ImgSprite,
  TextSprite,
  VideoSprite,
} from '@webav/av-canvas';
import { AVRecorder } from '@webav/av-recorder';
import { Button } from 'antd';
import React, { useEffect, useState } from 'react';

let avCvs: AVCanvas | null = null;
function initCvs(attchEl: HTMLDivElement | null) {
  if (attchEl == null) return;
  avCvs = new AVCanvas(attchEl, {
    bgColor: '#333',
    resolution: {
      width: 1920,
      height: 1080,
    },
  });
}

let recorder: AVRecorder | null = null;
async function start() {
  if (avCvs == null) return;
  const fileHandle = await window.showSaveFilePicker({
    suggestedName: `WebAV-${Date.now()}.mp4`,
  });
  const writer = await fileHandle.createWritable();
  recorder = new AVRecorder(avCvs.captureStream(), {
    width: 1920,
    height: 1080,
    bitrate: 5e6,
    audioCodec: 'aac',
  });
  await recorder.start();
  recorder.outputStream?.pipeTo(writer).catch(console.error);
}

export default function UI() {
  const [stateText, setStateText] = useState('');
  useEffect(() => {
    return () => {
      avCvs?.destroy();
    };
  }, []);
  return (
    <>
      添加素材：
      <Button
        onClick={async () => {
          if (avCvs == null) return;
          const mediaStream = await navigator.mediaDevices.getUserMedia({
            video: true,
            audio: true,
          });
          const vs = new VideoSprite('userMedia', mediaStream, {
            audioCtx: avCvs.spriteManager.audioCtx,
          });
          await avCvs.spriteManager.addSprite(vs);
        }}
      >
        Camera & Micphone
      </Button>
      &nbsp;
      <Button
        onClick={async () => {
          if (avCvs == null) return;
          const mediaStream = await navigator.mediaDevices.getDisplayMedia({
            video: true,
            audio: true,
          });
          const vs = new VideoSprite('display', mediaStream, {
            audioCtx: avCvs.spriteManager.audioCtx,
          });
          await avCvs.spriteManager.addSprite(vs);
        }}
      >
        Share screen
      </Button>
      &nbsp;
      <Button
        onClick={async () => {
          if (avCvs == null) return;
          const is = new ImgSprite(
            'img',
            await loadFile({ 'image/*': ['.png', '.gif', '.jpeg', '.jpg'] }),
          );
          await avCvs.spriteManager.addSprite(is);
        }}
      >
        Image
      </Button>
      &nbsp;
      <Button
        onClick={async () => {
          if (avCvs == null) return;
          const vs = new VideoSprite(
            'video',
            await loadFile({ 'video/*': ['.webm', '.mp4'] }),
            { audioCtx: avCvs.spriteManager.audioCtx },
          );
          await avCvs.spriteManager.addSprite(vs);
        }}
      >
        Video
      </Button>
      &nbsp;
      <Button
        onClick={async () => {
          if (avCvs == null) return;
          const as = new AudioSprite(
            'audio',
            await loadFile({ 'audio/*': ['.mp3', '.wav', '.ogg'] }),
            { audioCtx: avCvs.spriteManager.audioCtx },
          );
          await avCvs.spriteManager.addSprite(as);
        }}
      >
        Audio
      </Button>
      &nbsp;
      <Button
        onClick={async () => {
          if (avCvs == null) return;
          const fs = new TextSprite('text', '示例文字');
          await avCvs.spriteManager.addSprite(fs);
        }}
      >
        Text
      </Button>
      <hr />
      <Button
        onClick={async () => {
          await start();
          setStateText('录制中...');
        }}
      >
        Start Recod
      </Button>
      &nbsp;
      <Button
        onClick={async () => {
          await recorder?.stop();
          setStateText('视频已保存');
        }}
      >
        Stop Recod
      </Button>
      <span style={{ marginLeft: 16, color: '#666' }}>{stateText}</span>
      <div
        ref={initCvs}
        style={{ width: 900, height: 500, position: 'relative' }}
      ></div>
    </>
  );
}

async function loadFile(accept: Record<string, string[]>) {
  const [fileHandle] = await (window as any).showOpenFilePicker({
    types: [{ accept }],
  });
  return await fileHandle.getFile();
}
