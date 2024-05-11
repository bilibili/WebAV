import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Timeline, TimelineRow } from '@xzdarcy/react-timeline-editor';
import './video-editor.css';
import { AVCanvas } from '../src';

const TimelineEditor = ({ clips }: { clips: TimelineRow[] }) => {
  return (
    <div className="">
      <Timeline onChange={(d) => {}} editorData={clips} effects={{}} />
    </div>
  );
};

function App() {
  const [avCvs, setAVCvs] = useState<AVCanvas | null>(null);
  const [cvsWrapEl, setCvsWrapEl] = useState<HTMLDivElement | null>(null);
  const [clips, setClips] = useState<TimelineRow[]>([
    { id: '0', actions: [] },
    { id: '1', actions: [] },
    { id: '2', actions: [] },
    { id: '3', actions: [] },
  ]);

  useEffect(() => {
    if (cvsWrapEl == null) return;
    avCvs?.destroy();
    setAVCvs(
      new AVCanvas(cvsWrapEl, {
        bgColor: '#000',
        width: 1280,
        height: 720,
      })
    );
  }, [cvsWrapEl]);

  return (
    <div className="canvas-wrap">
      <div ref={(el) => setCvsWrapEl(el)}></div>
      <button
        className="mx-[10px]"
        onClick={() => {
          const track = clips.find(({ id }) => id === '0');
          if (track == null) return;
          const maxTime = Math.max(...track.actions.map((a) => a.end));
          track.actions.push({
            id: Math.random().toString(),
            start: maxTime,
            end: maxTime + 2,
            effectId: '',
          });
          setClips(
            clips
              .filter((it) => it !== track)
              .concat({ ...track })
              .sort((a, b) => Number(a.id) - Number(b.id))
          );
        }}
      >
        + 视频
      </button>
      <button className="mx-[10px]">+ 音频</button>
      <button className="mx-[10px]">+ 图片</button>
      <button className="mx-[10px]">+ 文字</button>
      <TimelineEditor clips={clips}></TimelineEditor>
    </div>
  );
}

const root = createRoot(document.getElementById('app')!);
root.render(<App />);
