import { useEffect, useState } from 'react';
import { createRoot } from 'react-dom/client';
import {
  Timeline,
  TimelineAction,
  TimelineRow,
} from '@xzdarcy/react-timeline-editor';
import './video-editor.css';
import { AVCanvas } from '../src';
import {
  AudioClip,
  ImgClip,
  MP4Clip,
  VisibleSprite,
  renderTxt2ImgBitmap,
} from '@webav/av-cliper';

const TimelineEditor = ({
  timelineData: tlData,
  onPreviewTime,
  onOffsetChange,
  onDuraionChange,
  onDeleteAction,
}: {
  timelineData: TimelineRow[];
  onPreviewTime: (time: number) => void;
  onOffsetChange: (action: TimelineAction) => void;
  onDuraionChange: (args: {
    action: TimelineAction;
    start: number;
    end: number;
  }) => void;
  onDeleteAction: (action: TimelineAction) => void;
}) => {
  const [scale, setScale] = useState(10);
  const [activeAction, setActiveAction] = useState<TimelineAction | null>(null);
  return (
    <div className="">
      <div>
        缩放：
        <button
          onClick={() => setScale(scale + 1)}
          className="border rounded-full"
        >
          -
        </button>
        <button
          onClick={() => setScale(scale - 1 > 1 ? scale - 1 : 1)}
          className="border rounded-full"
        >
          +
        </button>
        <span className="mx-[10px]">|</span>
        <button
          onClick={() => {
            if (activeAction == null) return;
            onDeleteAction(activeAction);
          }}
        >
          删除
        </button>
      </div>
      <Timeline
        onChange={(d) => {}}
        scale={scale}
        editorData={tlData}
        effects={{}}
        scaleSplitCount={5}
        onClickTimeArea={(time) => {
          onPreviewTime(time);
          return true;
        }}
        onCursorDragEnd={(time) => {
          onPreviewTime(time);
        }}
        onActionResizing={({ dir, action, start, end }) => {
          if (dir === 'left') return false;
          return onDuraionChange({ action, start, end });
        }}
        onActionMoveEnd={({ action }) => {
          onOffsetChange(action);
        }}
        onClickAction={(_, { action }) => {
          setActiveAction(action);
        }}
        getActionRender={(action) => {
          if (action.id === activeAction?.id) {
            return (
              <div className="w-full h-full border border-red-300 border-solid"></div>
            );
          }
          return <div></div>;
        }}
        autoScroll
      />
    </div>
  );
};

const actionSpriteMap = new WeakMap<TimelineAction, VisibleSprite>();

function App() {
  const [avCvs, setAVCvs] = useState<AVCanvas | null>(null);
  const [cvsWrapEl, setCvsWrapEl] = useState<HTMLDivElement | null>(null);
  const [tlData, setTLData] = useState<TimelineRow[]>([
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

  function addItem2Track(trackId: string, spr: VisibleSprite) {
    const track = tlData.find(({ id }) => id === trackId);
    if (track == null) return null;

    const maxTime = Math.max(...track.actions.map((a) => a.end), 0);
    spr.time.offset = maxTime * 1e6;

    const action = {
      id: Math.random().toString(),
      start: maxTime,
      end: (spr.time.offset + spr.time.duration) / 1e6,
      effectId: '',
    };

    actionSpriteMap.set(action, spr);

    track.actions.push(action);
    setTLData(
      tlData
        .filter((it) => it !== track)
        .concat({ ...track })
        .sort((a, b) => a.id.charCodeAt(0) - b.id.charCodeAt(0))
    );
    return action;
  }

  return (
    <div className="canvas-wrap">
      <div ref={(el) => setCvsWrapEl(el)}></div>
      <button
        className="mx-[10px]"
        onClick={async () => {
          const spr = new VisibleSprite(
            new MP4Clip((await fetch('./video/bunny_0.mp4')).body!)
          );
          await avCvs?.addSprite(spr);
          addItem2Track('1-video', spr);
        }}
      >
        + 视频
      </button>
      <button
        className="mx-[10px]"
        onClick={async () => {
          const spr = new VisibleSprite(
            new AudioClip((await fetch('./audio/16kHz-1chan.mp3')).body!)
          );
          await avCvs?.addSprite(spr);
          addItem2Track('2-audio', spr);
        }}
      >
        + 音频
      </button>
      <button
        className="mx-[10px]"
        onClick={async () => {
          const spr = new VisibleSprite(
            new ImgClip((await fetch('./img/bunny.png')).body!)
          );
          await avCvs?.addSprite(spr);
          spr.time.duration = 10e6;
          addItem2Track('3-img', spr);
        }}
      >
        + 图片
      </button>
      <button
        className="mx-[10px]"
        onClick={async () => {
          const spr = new VisibleSprite(
            new ImgClip(
              await renderTxt2ImgBitmap(
                '示例文字',
                'font-size: 80px; color: red;'
              )
            )
          );
          await avCvs?.addSprite(spr);
          spr.time.duration = 10e6;
          addItem2Track('4-text', spr);
        }}
      >
        + 文字
      </button>
      <span className="mx-[10px]">|</span>
      <button
        className="mx-[10px]"
        onClick={async () => {
          if (avCvs == null) return;
          (await avCvs.createCombinator())
            .output()
            .pipeTo(await createFileWriter('mp4'));
        }}
      >
        导出视频
      </button>
      <p></p>
      <TimelineEditor
        timelineData={tlData}
        onPreviewTime={(time) => {
          avCvs?.previewFrame(time * 1e6);
        }}
        onOffsetChange={(action) => {
          const spr = actionSpriteMap.get(action);
          if (spr == null) return;
          spr.time.offset = action.start * 1e6;
        }}
        onDuraionChange={({ action, start, end }) => {
          const spr = actionSpriteMap.get(action);
          if (spr == null) return false;
          const duration = (end - start) * 1e6;
          if (duration > spr.getClip().meta.duration) return false;
          spr.time.duration = duration;
          return true;
        }}
        onDeleteAction={(action) => {
          const spr = actionSpriteMap.get(action);
          if (spr == null) return;
          avCvs?.removeSprite(spr);
          actionSpriteMap.delete(action);
          const track = tlData
            .map((t) => t.actions)
            .find((actions) => actions.includes(action));
          if (track == null) return;
          track.splice(track.indexOf(action), 1);
          setTLData([...tlData]);
        }}
      ></TimelineEditor>
    </div>
  );
}

const root = createRoot(document.getElementById('app')!);
root.render(<App />);

async function createFileWriter(
  extName: string
): Promise<FileSystemWritableFileStream> {
  const fileHandle = await window.showSaveFilePicker({
    suggestedName: `WebAV-export-${Date.now()}.${extName}`,
  });
  return fileHandle.createWritable();
}
