import { AudioClip } from '@webav/av-cliper';
import { Button, Radio } from 'antd';
import React, { useState, useEffect } from 'react';
import { assetsPrefix } from './utils';

const audios = assetsPrefix({
  '44.1kHz-2chan.m4a': 'audio/44.1kHz-2chan.m4a',
  '44.1kHz-2chan.mp3': 'audio/44.1kHz-2chan.mp3',
  '16kHz-1chan.mp3': 'audio/16kHz-1chan.mp3',
});

let stopAudio = () => {};
async function start(audioType: keyof typeof audios) {
  stopAudio();

  const clip = new AudioClip((await fetch(audios[audioType])).body!);
  await clip.ready;
  const ctx = new AudioContext();
  let time = 0;
  // 当前片段的开始播放的时间
  let startAt = 0;
  async function play() {
    time += 100000;
    const { audio, state } = await clip.tick(time);
    if (state === 'done') return;

    const len = audio[0].length;
    if (len === 0) {
      play();
      return;
    }

    const buf = ctx.createBuffer(2, len, 48000);
    buf.copyToChannel(audio[0], 0);
    buf.copyToChannel(audio[1], 1);
    const source = ctx.createBufferSource();
    source.buffer = buf;
    source.connect(ctx.destination);
    startAt = Math.max(ctx.currentTime, startAt);
    source.start(startAt);

    startAt += buf.duration;

    play();
  }
  play();

  stopAudio = () => ctx.close();
}

export default createUI(start);

// ---------- 以下是 UI 代码 ---------------

function createUI(start: Function) {
  return () => {
    const [value, setValue] = useState('44.1kHz-2chan.m4a');

    useEffect(() => {
      return () => stopAudio();
    }, [stopAudio]);

    return (
      <div>
        <Button
          onClick={() => {
            start(value as keyof typeof audios);
          }}
        >
          启动！
        </Button>
        <br />
        <Radio.Group
          onChange={(e) => {
            setValue(e.target.value);
          }}
          value={value}
        >
          <Radio value="44.1kHz-2chan.m4a">44.1kHz-2chan.m4a</Radio>
          <Radio value="44.1kHz-2chan.mp3">44.1kHz-2chan.mp3</Radio>
          <Radio value="16kHz-1chan.mp3">16kHz-1chan.mp3</Radio>
        </Radio.Group>
      </div>
    );
  };
}
