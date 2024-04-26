import { Parser } from 'm3u8-parser';

/**
 * 解析 HLS 地址，将索引的分片组装成 ReadableStream<Uint8Array>[] (二进制流数组)
 * 返回数组的长度等于 HLS 中 EXT-X-MAP（表示流 meta 信息出现变化）标签数量
 */
export async function parseHLSStream(m3u8URL: string) {
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

  return Object.entries(segGroup).map(([initUri, segments]) => {
    let segIdx = 0;
    return new ReadableStream<Uint8Array>({
      start: async (ctrl) => {
        ctrl.enqueue(
          new Uint8Array(
            await (await fetch(new URL(initUri, base).href)).arrayBuffer(),
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
    });
  });
}
