import { Parser } from 'm3u8-parser';
import { Log } from '../log';
import { EventTool } from '../event-tool';

/**
 * 创建一个 HLS 资源加载器
 */
export async function createHLSLoader(m3u8URL: string, concurrency = 10) {
  const parser = new Parser();
  parser.push(await (await fetch(m3u8URL)).text());
  parser.end();
  const segGroup = parser.manifest.segments.reduce(
    (acc, cur) => {
      acc[cur.map.uri] = acc[cur.map.uri] ?? [];
      acc[cur.map.uri].push(cur);
      return acc;
    },
    {} as Record<string, Parser['manifest']['segments']>,
  );
  const base = new URL(m3u8URL, location.href);

  const segmentBufferFetchqueue = {} as Record<string, Promise<ArrayBuffer>>;

  async function downloadSegments(
    segments: Parser['manifest']['segments'],
    ctrl: ReadableStreamDefaultController<Uint8Array>,
    evtTool: EventTool<{ progress: (progress: number) => void }>,
  ) {
    function createTaskQueue(concurrency: number) {
      let running = 0;
      let done = 0;
      let queue = [] as Array<() => Promise<ArrayBuffer>>;

      async function runTask(task: () => Promise<ArrayBuffer>) {
        queue.push(task);
        next();
      }

      async function next() {
        if (running < concurrency && queue.length) {
          const task = queue.shift();
          running++;
          try {
            await task?.();
            done++;
            evtTool.emit(
              'progress',
              Math.round((done / segments.length) * 100) / 100,
            );
            next();
          } catch (err) {
            queue = [];
            ctrl.error(err);
            evtTool.destroy();
            Log.error(err);
          }
          running--;
        }
      }

      return runTask;
    }

    async function fetchSegmentBufferPromise(url: string) {
      return (await fetch(url)).arrayBuffer();
    }

    const runTask = createTaskQueue(concurrency);

    for (const [, item] of segments.entries()) {
      const url = new URL(item.uri, base).href;
      runTask(
        () => (segmentBufferFetchqueue[url] = fetchSegmentBufferPromise(url)),
      );
    }
  }

  async function getSegmentBuffer(url: string) {
    const segmentBuffer = await segmentBufferFetchqueue[url];
    delete segmentBufferFetchqueue[url];
    return segmentBuffer;
  }

  return {
    /**
     * 下载期望时间区间的分配数据，封装成流
     * 每个分片包含一个时间段，实际下载的分片数据时长会略大于期望的时间区间
     */
    load(expectStartTime = 0, expectEndTime = Infinity) {
      const filterSegGroup = {} as Record<
        string,
        {
          actualStartTime: number;
          actualEndTime: number;
          segments: Parser['manifest']['segments'];
        }
      >;
      let actualStartTime = 0;
      let actualEndTime = 0;
      for (const [gKey, gData] of Object.entries(segGroup)) {
        let time = 0;
        let segs = [] as Parser['manifest']['segments'];
        let startIdx = -1;
        let endIdx = -1;
        for (let i = 0; i < gData.length; i++) {
          const seg = gData[i];
          time += seg.duration;
          if (startIdx === -1 && time > expectStartTime / 1e6) {
            startIdx = i;
            actualStartTime = (time - seg.duration) * 1e6;
          }
          if (startIdx > -1 && endIdx === -1 && time >= expectEndTime / 1e6) {
            endIdx = i + 1;
            actualEndTime = time * 1e6;
            break;
          }
        }
        if (expectEndTime >= time * 1e6) {
          endIdx = gData.length;
          actualEndTime = time * 1e6;
        }

        if (endIdx > startIdx) {
          segs = segs.concat(gData.slice(startIdx, endIdx));
        }
        if (segs.length > 0)
          filterSegGroup[gKey] = {
            actualStartTime,
            actualEndTime,
            segments: segs,
          };
      }

      if (Object.keys(filterSegGroup).length === 0) return null;

      return Object.entries(filterSegGroup).map(
        ([initUri, { actualStartTime, actualEndTime, segments }]) => {
          let segIdx = 0;

          const evtTool = new EventTool<{
            progress: (progress: number) => void;
          }>();

          return {
            actualStartTime,
            actualEndTime,
            on: evtTool.on,
            stream: new ReadableStream<Uint8Array>({
              start: async (ctrl) => {
                downloadSegments(segments, ctrl, evtTool);
                ctrl.enqueue(
                  new Uint8Array(
                    await (
                      await fetch(new URL(initUri, base).href)
                    ).arrayBuffer(),
                  ),
                );
              },
              pull: async (ctrl) => {
                const url = new URL(segments[segIdx].uri, base).href;
                ctrl.enqueue(new Uint8Array(await getSegmentBuffer(url)));
                segIdx += 1;
                if (segIdx >= segments.length) {
                  ctrl.close();
                  evtTool.destroy();
                }
              },
            }),
          };
        },
      );
    },
  };
}
