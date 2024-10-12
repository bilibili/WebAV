/**
 * 自动读取流并处理每个数据块。
 *
 * @template ST - 可读流的类型。
 * @param stream - 要读取的流。
 * @param cbs - 回调函数对象。
 * @param cbs.onChunk - 当读取到新的数据块时调用的函数。该函数接收一个参数，即数据块，并返回一个 Promise。
 * @param cbs.onDone - 当读取完所有数据块时调用的函数。
 * @returns - 返回一个函数，调用该函数可以停止读取流。
 *
 * @example
 * const stream = getSomeReadableStream();
 * const onChunk = async (chunk) => {
 *   console.log('New chunk:', chunk);
 * };
 * const onDone = () => {
 *   console.log('Done reading stream');
 * };
 * const stopReading = autoReadStream(stream, { onChunk, onDone });
 * // Later...
 * stopReading();
 */
export function autoReadStream<ST extends ReadableStream>(
  stream: ST,
  cbs: {
    onChunk: ST extends ReadableStream<infer DT>
      ? (chunk: DT) => Promise<void>
      : never;
    onDone: () => void;
  },
) {
  let stoped = false;
  async function run() {
    const reader = stream.getReader();

    while (!stoped) {
      const { value, done } = await reader.read();
      if (done) {
        cbs.onDone();
        return;
      }
      await cbs.onChunk(value);
    }

    reader.releaseLock();
    await stream.cancel();
  }

  run().catch(console.error);

  return () => {
    stoped = true;
  };
}
