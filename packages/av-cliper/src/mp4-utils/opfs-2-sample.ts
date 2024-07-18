import { file } from 'opfs-tools';
import mp4box, {
  MP4Info,
  MP4Sample,
  MP4File,
  MP4ArrayBuffer,
} from '@webav/mp4box.js';

type OPFSToolFile = ReturnType<typeof file>;

export async function fileToMP4Samples(
  localFile: OPFSToolFile,
  cbs: {
    onReady: (data: { info: MP4Info; mp4BoxFile: MP4File }) => void;
    onSamples: (data: {
      id: number;
      type: 'video' | 'audio';
      samples: MP4Sample[];
    }) => void;
    onDone: () => void;
  },
) {
  const reader = await localFile.createReader();
  const file = mp4box.createFile();

  file.onReady = (info) => {
    const vTrackId = info.videoTracks[0]?.id;
    if (vTrackId != null)
      file.setExtractionOptions(vTrackId, 'video', { nbSamples: 100 });

    const aTrackId = info.audioTracks[0]?.id;
    if (aTrackId != null)
      file.setExtractionOptions(aTrackId, 'audio', { nbSamples: 100 });

    file.start();

    cbs.onReady({ info, mp4BoxFile: file });
  };

  const releasedCnt: Record<number, number> = {};
  file.onSamples = (id, type, samples) => {
    releasedCnt[id] = (releasedCnt[id] ?? 0) + samples.length;
    file.releaseUsedSamples(id, releasedCnt[id]);
    cbs.onSamples({ id, type, samples: samples.map((s) => ({ ...s })) });
  };

  file.onFlush = () => {
    reader.close();
    cbs.onDone();
  };

  let inputBufOffset = 0;
  const chunkSize = 1024 * 100;
  async function readChunk(start: number, end: number) {
    if (start >= end - 1) return;
    const data = await reader.read(end - start, { at: start });
    const inputBuf = data as MP4ArrayBuffer;
    inputBuf.fileStart = inputBufOffset;
    inputBufOffset += inputBuf.byteLength;
    const next = await file.appendBuffer(inputBuf);
    console.log({ start, end, next, len: inputBuf.byteLength });
    if (!next || next === start) {
      return cbs.onDone();
    }
    const nextStart = start + chunkSize;
    await readChunk(nextStart, nextStart + chunkSize);
  }

  await readChunk(0, chunkSize);

  return {
    stop: () => {
      file.flush();
      file.stop();
      file.onFlush?.();
      reader.close();
    },
  };
}
