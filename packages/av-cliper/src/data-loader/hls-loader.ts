import { Parser } from 'm3u8-parser';

/**
 * 创建一个 HLS 资源加载器
 */
export async function createHLSLoader(m3u8URL: string) {
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
          // todo: find last key frame
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

      console.log(
        11111,
        actualStartTime,
        JSON.stringify(filterSegGroup, null, 2),
      );
      return Object.entries(filterSegGroup).map(
        ([initUri, { actualStartTime, actualEndTime, segments }]) => {
          let segIdx = 0;
          return {
            actualStartTime,
            actualEndTime,
            stream: new ReadableStream<Uint8Array>({
              start: async (ctrl) => {
                ctrl.enqueue(
                  new Uint8Array(
                    await (
                      await fetch(new URL(initUri, base).href)
                    ).arrayBuffer(),
                  ),
                );
              },
              pull: async (ctrl) => {
                ctrl.enqueue(
                  new Uint8Array(
                    await (
                      await fetch(new URL(segments[segIdx].uri, base).href)
                    ).arrayBuffer(),
                  ),
                );
                segIdx += 1;
                if (segIdx >= segments.length) ctrl.close();
              },
            }),
          };
        },
      );
    },
  };
}
