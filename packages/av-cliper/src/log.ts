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
(async function init() {
  writer = await localFile.createWriter();
});

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
              .join(' ')}\n`
          );
        }
      },
    }),
  {} as Record<LvName, typeof console.log>
);

const map = new Map<Function, number>();
export const Log = {
  setLogLevel: <T extends Function>(logfn: T) => {
    THRESHOLD = map.get(logfn) ?? 1;
  },
  ...lvHandler,
  // 生成一个 log 实例，所有输出前都会附加 tag
  create: (tag: string) => {
    return Object.fromEntries(
      Object.entries(lvHandler).map(([k, h]) => [
        k,
        (...args: any[]) => h(tag, ...args),
      ])
    );
  },

  async dump() {
    await writer?.flush();
    return await localFile.text();
  },
};

map.set(Log.debug, 0);
map.set(Log.info, 1);
map.set(Log.warn, 2);
map.set(Log.error, 3);

if (import.meta.env?.DEV) {
  Log.setLogLevel(Log.debug);
}

if (import.meta.env?.MODE === 'test') {
  Log.setLogLevel(Log.warn);
}
