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
    { id: '1-video', actions: [] },
    { id: '2-audio', actions: [] },
    { id: '3-img', actions: [] },
    { id: '4-text', actions: [] },
  ]);

  useEffect(() => {
    if (cvsWrapEl == null) return;
    avCvs?.destroy();
    const cvs = new AVCanvas(cvsWrapEl, {
      bgColor: '#000',
      width: 1280,
      height: 720,
    });
    setAVCvs(cvs);

    return () => {
      cvs?.destroy();
    };
  }, [cvsWrapEl]);

  function addItem2Track(trackId: string) {
    const track = clips.find(({ id }) => id === trackId);
    if (track == null) return;
    const maxTime = Math.max(...track.actions.map((a) => a.end), 0);
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
        .sort((a, b) => a.id.charCodeAt(0) - b.id.charCodeAt(0)),
    );
  }

  return (
    <div className="canvas-wrap">
      <div ref={(el) => setCvsWrapEl(el)}></div>
      <button
        className="mx-[10px]"
        onClick={() => {
          addItem2Track('1-video');
        }}
      >
        + 视频
      </button>
      <button
        className="mx-[10px]"
        onClick={() => {
          addItem2Track('2-audio');
        }}
      >
        + 音频
      </button>
      <button
        className="mx-[10px]"
        onClick={() => {
          addItem2Track('3-img');
        }}
      >
        + 图片
      </button>
      <button
        className="mx-[10px]"
        onClick={() => {
          addItem2Track('4-text');
        }}
      >
        + 文字
      </button>
      <TimelineEditor clips={clips}></TimelineEditor>
    </div>
  );
}

const root = createRoot(document.getElementById('app')!);
root.render(<App />);
