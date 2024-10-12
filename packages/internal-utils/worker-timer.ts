const setup = (): void => {
  let timerId: number;

  let interval: number = 16.6;

  self.onmessage = (e) => {
    if (e.data.event === 'start') {
      self.clearInterval(timerId);
      timerId = self.setInterval(() => {
        self.postMessage({});
      }, interval);
    }

    if (e.data.event === 'stop') {
      self.clearInterval(timerId);
    }
  };
};

const createWorker = (): Worker => {
  const blob = new Blob([`(${setup.toString()})()`]);
  const url = URL.createObjectURL(blob);
  return new Worker(url);
};

const handlerMap = new Map<number, Set<() => void>>();
let runCount = 1;

let worker: Worker | null = null;
if (globalThis.Worker != null) {
  worker = createWorker();
  worker.onmessage = () => {
    runCount += 1;
    for (const [k, v] of handlerMap) {
      if (runCount % k === 0) for (const fn of v) fn();
    }
  };
}

/**
 * 专门解决页面长时间处于后台时，定时器不（或延迟）执行的问题
 *
 * 跟 `setInterval` 很相似，⚠️ 但 time 会有一定偏差，请优先使用 `setInterval`
 *
 * @see [JS 定时器时长控制细节](https://hughfenghen.github.io/posts/2023/06/15/timer-delay/)
 */
export const workerTimer = (
  handler: () => void,
  time: number,
): (() => void) => {
  const groupId = Math.round(time / 16.6);
  const fns = handlerMap.get(groupId) ?? new Set();
  fns.add(handler);
  handlerMap.set(groupId, fns);

  if (handlerMap.size === 1 && fns.size === 1) {
    worker?.postMessage({ event: 'start' });
  }

  return () => {
    fns.delete(handler);
    if (fns.size === 0) handlerMap.delete(groupId);
    if (handlerMap.size === 0) {
      runCount = 0;
      worker?.postMessage({ event: 'stop' });
    }
  };
};
