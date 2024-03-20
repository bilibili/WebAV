import { MP4File, MP4Info, MP4Sample } from '@webav/mp4box.js';
import { autoReadStream, createGoPVideoDecoder } from '../av-utils';
import { extractFileConfig, sample2ChunkOpts } from './mp4box-utils';
import { file } from 'opfs-tools';
import { SampleTransform } from './sample-transform';

// !!! Deprecated, use MP4Clip.getVideoFrame
export class MP4Previewer {
  #ready: Promise<MP4Info>;

  #videoSamples: Array<
    Omit<MP4Sample, 'data'> & {
      offset: number;
      timeEnd: number;
      data: null;
    }
  > = [];

  #opfsFile = file(Math.random().toString());

  #wrapDecoder: ReturnType<typeof createGoPVideoDecoder> | null = null;

  #cvs: OffscreenCanvas | null = null;
  #ctx: OffscreenCanvasRenderingContext2D | null = null;

  constructor(stream: ReadableStream<Uint8Array>) {
    this.#ready = this.#init(stream);
  }

  async #init(stream: ReadableStream<Uint8Array>) {
    let offset = 0;
    const writer = await this.#opfsFile.createWriter();
    return new Promise<MP4Info>((resolve, reject) => {
      let mp4Info: MP4Info | null = null;
      let mp4boxFile: MP4File | null = null;
      autoReadStream(stream.pipeThrough(new SampleTransform()), {
        onChunk: async ({ chunkType, data }): Promise<void> => {
          if (chunkType === 'ready') {
            const { videoDecoderConf, videoTrackConf } = extractFileConfig(
              data.file,
              data.info,
            );
            if (videoDecoderConf == null || videoTrackConf == null) {
              reject('Unsupported codec');
              return;
            }
            mp4Info = {
              ...data.info,
              duration: videoTrackConf.duration ?? 0,
              timescale: videoTrackConf.timescale,
            };
            mp4boxFile = data.file;
            const { width, height } = data.info.videoTracks[0].video;
            this.#cvs = new OffscreenCanvas(width, height);
            this.#ctx = this.#cvs.getContext('2d');

            this.#wrapDecoder = createGoPVideoDecoder(videoDecoderConf);
          }
          if (chunkType === 'samples') {
            if (data.type === 'video') {
              for (const s of data.samples) {
                this.#videoSamples.push({
                  ...s,
                  offset,
                  timeEnd: s.cts + s.duration,
                  data: null,
                });
                offset += s.data.byteLength;
                await writer.write(s.data);
              }
            }
            mp4boxFile?.releaseUsedSamples(data.id, data.samples.length);
          }
        },
        onDone: async () => {
          await writer.close();
          if (mp4Info == null) {
            reject('Parse failed');
            return;
          }
          resolve(mp4Info);
        },
      });
    });
  }

  async getInfo() {
    return await this.#ready;
  }

  // time 单位秒 s
  async getVideoFrame(time: number): Promise<VideoFrame | null> {
    if (time < 0) return null;
    const info = await this.#ready;
    if (time > info.duration / info.timescale) return null;

    let timeMapping = time * info.timescale;
    let start = 0;
    let end = 0;
    for (let i = 0; i < this.#videoSamples.length; i += 1) {
      const si = this.#videoSamples[i];
      if (si.cts <= timeMapping && si.timeEnd >= timeMapping) {
        end = i;
        // 寻找最近的一个 关键帧
        if (!si.is_sync) {
          for (let j = i - 1; j >= 0; j -= 1) {
            const sj = this.#videoSamples[j];
            if (sj.is_sync) {
              start = j;
              break;
            }
          }
        }
        break;
      }
    }

    const reader = await this.#opfsFile.createReader();
    const chunks = await Promise.all(
      this.#videoSamples.slice(start, end + 1).map(
        async (s) =>
          new EncodedVideoChunk(
            sample2ChunkOpts({
              ...s,
              data: await reader.read(s.offset, { at: s.size }),
            }),
          ),
      ),
    );
    await reader.close();
    if (chunks.length === 0) return Promise.resolve(null);

    return new Promise<VideoFrame | null>((resolve) => {
      this.#wrapDecoder?.decode(chunks, (vf, done) => {
        if (done) resolve(vf);
        else vf?.close();
      });
    });
  }

  async getImage(time: number) {
    const vf = await this.getVideoFrame(time);
    if (vf == null || this.#cvs == null || this.#ctx == null) return;

    this.#ctx.drawImage(vf, 0, 0);
    vf.close();
    const src = URL.createObjectURL(await this.#cvs.convertToBlob());
    this.#ctx.clearRect(0, 0, this.#cvs.width, this.#cvs.height);
    return src;
  }
}
