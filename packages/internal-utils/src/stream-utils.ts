import mp4box, { MP4File } from '@webav/mp4box.js';
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

/**
 * 将 mp4box file 转换为文件流，用于上传服务器或存储到本地
 * @param file - MP4 文件实例 {@link MP4File}。
 * @param timeSlice - 时间片，用于控制流的发送速度。
 * @param onCancel - 当返回的流被取消时触发该回调函数
 */
export function file2stream(
  file: MP4File,
  timeSlice: number,
  onCancel?: () => void,
): {
  /**
   * 可读流，流的数据是 `Uint8Array`
   */
  stream: ReadableStream<Uint8Array>;
  /**
   * 流的生产者主动停止向流中输出数据，可向消费者传递错误信息
   */
  stop: (err?: Error) => void;
} {
  let timerId = 0;

  let sendedBoxIdx = 0;
  const boxes = file.boxes;

  let firstMoofReady = false;
  const deltaBuf = (): Uint8Array | null => {
    // 避免 moov 未完成时写入文件，导致文件无法被识别
    if (!firstMoofReady) {
      if (boxes.find((box) => box.type === 'moof') != null) {
        firstMoofReady = true;
      } else {
        return null;
      }
    }
    if (sendedBoxIdx >= boxes.length) return null;

    const ds = new mp4box.DataStream();
    ds.endianness = mp4box.DataStream.BIG_ENDIAN;

    let i = sendedBoxIdx;
    try {
      for (; i < boxes.length; ) {
        boxes[i].write(ds);
        delete boxes[i];
        i += 1;
      }
    } catch (err) {
      const errBox = boxes[i];
      if (err instanceof Error && errBox != null) {
        throw Error(
          `${err.message} | deltaBuf( boxType: ${errBox.type}, boxSize: ${errBox.size}, boxDataLen: ${errBox.data?.length ?? -1})`,
        );
      }
      throw err;
    }

    unsafeReleaseMP4BoxFile(file);

    sendedBoxIdx = boxes.length;
    return new Uint8Array(ds.buffer);
  };

  let stoped = false;
  let canceled = false;
  let exit: ((err?: Error) => void) | null = null;
  const stream = new ReadableStream({
    start(ctrl) {
      timerId = self.setInterval(() => {
        const d = deltaBuf();
        if (d != null && !canceled) ctrl.enqueue(d);
      }, timeSlice);

      exit = (err) => {
        clearInterval(timerId);
        file.flush();
        if (err != null) {
          ctrl.error(err);
          return;
        }

        const d = deltaBuf();
        if (d != null && !canceled) ctrl.enqueue(d);

        if (!canceled) ctrl.close();
      };

      // 安全起见，检测如果start触发时已经 stoped
      if (stoped) exit();
    },
    cancel() {
      canceled = true;
      clearInterval(timerId);
      onCancel?.();
    },
  });

  return {
    stream,
    stop: (err) => {
      if (stoped) return;
      stoped = true;
      exit?.(err);
    },
  };
}

/**
 * 强行回收 mp4boxfile 尽量降低内存占用，会破坏 file 导致无法正常使用
 * 仅用于获取二进制后，不再需要任何 file 功能的场景
 */
function unsafeReleaseMP4BoxFile(file: MP4File) {
  if (file.moov == null) return;
  for (var j = 0; j < file.moov.traks.length; j++) {
    file.moov.traks[j].samples = [];
  }
  file.mdats = [];
  file.moofs = [];
}
