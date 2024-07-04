import { tmpfile } from 'opfs-tools';

/**
 * 将任意对象转换成String，如果包含Error，则将Error转换为err.toString()
 * @param val any
 */
function any2Str(val: any): string {
  if (val instanceof Error) return String(val);
  return typeof val === 'object'
    ? JSON.stringify(val, (_, v) => (v instanceof Error ? String(v) : v))
    : String(val);
}

function getTimeStr() {
  const d = new Date();
  return `${d.getHours()}:${d.getMinutes()}:${d.getSeconds()}.${d.getMilliseconds()}`;
}

let THRESHOLD = 1;

const localFile = tmpfile();

let writer: Awaited<ReturnType<typeof localFile.createWriter>> | null = null;

type LvName = 'debug' | 'info' | 'warn' | 'error';
const lvHandler = ['debug', 'info', 'warn', 'error'].reduce(
  (acc, lvName, lvThres) =>
    Object.assign(acc, {
      [lvName]: (...args: any[]) => {
        if (THRESHOLD <= lvThres) {
          console[lvName as LvName](...args);
          writer?.write(
            `[${lvName}][${getTimeStr()}]  ${args
              .map((a) => any2Str(a))
              .join(' ')}\n`,
          );
        }
      },
    }),
  {} as Record<LvName, typeof console.log>,
);

const map = new Map<Function, number>();

/**
 * 全局日志对象，将日志内容写入 OPFS 临时文件
 */
export const Log = {
  /**
   * 设置记录日志的级别
   *
   * @example
   * Log.setLogLevel(Log.warn) // 记录 warn，error 日志
   */
  setLogLevel: <T extends Function>(logfn: T) => {
    THRESHOLD = map.get(logfn) ?? 1;
  },
  ...lvHandler,
  /**
   * 生成一个 log 实例，所有输出前都会附加 tag
   *
   * @example
   * const log = Log.create('<prefix>')
   * log.info('xxx') // '<prefix> xxx'
   */
  create: (tag: string) => {
    return Object.fromEntries(
      Object.entries(lvHandler).map(([k, h]) => [
        k,
        (...args: any[]) => h(tag, ...args),
      ]),
    );
  },

  /**
   * 将所有日志导出为一个字符串
   *
   * @example
   * Log.dump() // => [level][time]  内容...
   *
   */
  async dump() {
    await initPromise;
    await writer?.flush();
    return await localFile.text();
  },
};

map.set(Log.debug, 0);
map.set(Log.info, 1);
map.set(Log.warn, 2);
map.set(Log.error, 3);

const initPromise = (async function init() {
  try {
    writer = await localFile.createWriter();
    Log.info(navigator.userAgent);
    Log.info('date: ' + new Date().toLocaleDateString());
  } catch (err) {
    if (!(err instanceof Error)) throw err;
    if (err.message.includes('createSyncAccessHandle is not a function')) {
      console.warn(err);
    } else {
      throw err;
    }
  }
})();

if (import.meta.env?.DEV) {
  Log.setLogLevel(Log.debug);
}

if (import.meta.env?.MODE === 'test') {
  Log.setLogLevel(Log.warn);
}
