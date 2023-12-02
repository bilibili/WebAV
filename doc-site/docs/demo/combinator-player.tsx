import { Combinator } from '@webav/av-cliper';
import { Button } from 'antd';
import React, { useEffect, useState } from 'react';

export function CombinatorPlay({
  list,
  onStart,
  com,
}: {
  list: string[];
  onStart: () => void;
  com: Combinator | null;
}) {
  const [state, setState] = useState('');
  const [videoSrc, setVideoSrc] = useState('');

  useEffect(() => {
    (async () => {
      if (com == null) return;
      setState('合成中...');
      const timeStart = performance.now();
      const srcBlob = await new Response(com.output()).blob();
      setVideoSrc(URL.createObjectURL(srcBlob));
      setState(`合成耗时: ${Math.round(performance.now() - timeStart)}ms`);
    })();
  }, [com]);
  return (
    <div>
      <Button
        onClick={() => {
          setState('loading...');
          onStart();
        }}
      >
        启动！
      </Button>
      <div className="resouse-list">
        素材：
        {list.map((it) => (
          <a href={it} target="_blank" key={it} style={{ marginRight: '16px' }}>
            {it}
          </a>
        ))}
      </div>
      <div className="state">{state}</div>
      {videoSrc.length > 0 && (
        <video
          src={videoSrc}
          controls
          autoPlay
          style={{
            width: '600px',
            height: '333px',
            display: 'block',
          }}
        ></video>
      )}
    </div>
  );
}
