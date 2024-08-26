import {
  MP4ArrayBuffer,
  MP4File,
  MP4Info,
  MP4Sample,
  createFile,
} from '@webav/mp4box.js';
import { Log } from '../log';
import { getAllBoxes } from './mp4box-utils';

/**
 * 将原始字节流转换成 MP4Sample 流
 */
export class SampleTransform {
  #log = Log.create('SampleTransform: ');

  readable: ReadableStream<
    | {
        chunkType: 'ready';
        data: { info: MP4Info; file: MP4File };
      }
    | {
        chunkType: 'samples';
        data: { id: number; type: 'video' | 'audio'; samples: MP4Sample[] };
      }
  >;

  writable: WritableStream<Uint8Array>;

  #inputBufOffset = 0;
  #leftOverSize = 0;
  #leftOverType = '';
  constructor() {
    const file = createFile();
    let streamCancelled = false;
    this.readable = new ReadableStream(
      {
        start: (ctrl) => {
          file.onReady = (info) => {
            const vTrackId = info.videoTracks[0]?.id;
            if (vTrackId != null)
              file.setExtractionOptions(vTrackId, 'video', { nbSamples: 100 });

            const aTrackId = info.audioTracks[0]?.id;
            if (aTrackId != null)
              file.setExtractionOptions(aTrackId, 'audio', { nbSamples: 100 });

            ctrl.enqueue({ chunkType: 'ready', data: { info, file } });
            file.start();
          };
          file.onFlush = () => {
            ctrl.close();
          };
        },
        cancel: () => {
          file.stop();
          streamCancelled = true;
        },
      },
      {
        // 每条消息 100 个 samples
        highWaterMark: 50,
      },
    );

    this.writable = new WritableStream({
      write: async (ui8Arr) => {
        if (streamCancelled) {
          this.writable.abort();
          return;
        }

        // this.#log.info('read file length: ', ui8Arr.length);
        if (this.#leftOverSize >= ui8Arr.length) {
          this.#leftOverSize = this.#leftOverSize - ui8Arr.length;
          if (this.#leftOverType !== 'mdat') {
            const tmpBuf = ui8Arr.buffer as MP4ArrayBuffer;
            tmpBuf.fileStart = this.#inputBufOffset;
            file.appendBuffer(tmpBuf);
            this.#log.info(
              `appended complete chunk for ${this.#leftOverType}, size: ${tmpBuf.byteLength}, from ${tmpBuf.fileStart} to ${tmpBuf.fileStart + tmpBuf.byteLength}`,
            );
          } else {
            // this.#log.info(`jump mdat size ${ui8Arr.length}`);
          }
          this.#inputBufOffset += ui8Arr.length;
          return;
        }
        const boxes = getAllBoxes(ui8Arr, 2000, this.#leftOverSize);
        this.#log.info(`offset ${this.#leftOverSize} boxes: `, boxes);
        const lastBox = boxes[boxes.length - 1];
        if (this.#leftOverType !== 'mdat' && this.#leftOverSize > 0) {
          const tmpBuf = ui8Arr.slice(0, this.#leftOverSize)
            .buffer as MP4ArrayBuffer;
          tmpBuf.fileStart = this.#inputBufOffset;
          file.appendBuffer(tmpBuf);
        }
        this.#leftOverType = lastBox.type;
        this.#leftOverSize = lastBox.offset + lastBox.size - ui8Arr.length;
        boxes.map((box) => {
          if (box.type !== 'mdat') {
            if (box.offset + box.size <= ui8Arr.length) {
              const tmpBuf = ui8Arr.slice(
                box.offset,
                box.offset + box.size + 30,
              ).buffer as MP4ArrayBuffer; // +30 为mp4box机制，需要多读取一部分数据
              tmpBuf.fileStart = this.#inputBufOffset + box.offset;
              file.appendBuffer(tmpBuf);
              this.#log.info(
                `appended complete ${box.type} box, size: ${tmpBuf.byteLength}, from ${tmpBuf.fileStart} to ${tmpBuf.fileStart + tmpBuf.byteLength}`,
              );
            } else {
              const tmpBuf = ui8Arr.slice(box.offset, ui8Arr.length)
                .buffer as MP4ArrayBuffer;
              tmpBuf.fileStart = this.#inputBufOffset + box.offset;
              file.appendBuffer(tmpBuf);
              this.#log.info(
                `appended incomplete ${box.type} box, size: ${tmpBuf.byteLength}, from ${tmpBuf.fileStart} to ${tmpBuf.fileStart + tmpBuf.byteLength}, ${box.offset + box.size - ui8Arr.length} left`,
              );
            }
          }
        });
        this.#inputBufOffset += ui8Arr.length;
      },
      close: () => {
        file.flush();
        file.stop();
        file.onFlush?.();
      },
    });
  }
}
