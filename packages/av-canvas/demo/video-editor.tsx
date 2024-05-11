import { useState } from 'react';
import { createRoot } from 'react-dom/client';
import { Timeline, TimelineRow } from '@xzdarcy/react-timeline-editor';
import './video-editor.css';

const TimelineEditor = ({ clips }: { clips: TimelineRow[] }) => {
  return (
    <div className="">
      <Timeline onChange={(d) => {}} editorData={clips} effects={{}} />
    </div>
  );
};

function App() {
  const [clips, setClips] = useState<TimelineRow[]>([
    {
      id: '0',
      actions: [
        {
          id: 'action00',
          start: 0,
          end: 2,
          effectId: '',
        },
      ],
    },
    {
      id: '1',
      actions: [
        {
          id: 'action10',
          start: 1.5,
          end: 5,
          effectId: '',
        },
      ],
    },
  ]);

  return (
    <div className="">
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
