let threshold = 1;

const lvHandler = {
  debug: (...args: any[]) => {
    if (threshold <= 0) console.debug(...args);
  },
  info: (...args: any[]) => {
    if (threshold <= 1) console.info(...args);
  },
  warn: (...args: any[]) => {
    if (threshold <= 2) console.warn(...args);
  },
  error: (...args: any[]) => {
    if (threshold <= 3) console.error(...args);
  },
};

const map = new Map<Function, number>();
export const Log = {
  setLogLevel: <T extends Function>(logfn: T) => {
    threshold = map.get(logfn) ?? 1;
  },
  ...lvHandler,
  // 生成一个 log 实例，所有输出前都会附加 tag
  create: (tag: string) => {
    return Object.fromEntries(
      Object.entries(lvHandler).map(([k, h]) => [
        k,
        (...args: any[]) => h(tag, ...args),
      ]),
    );
  },
};

map.set(Log.debug, 0);
map.set(Log.info, 1);
map.set(Log.warn, 2);
map.set(Log.error, 3);

if (import.meta?.env?.DEV) {
  Log.setLogLevel(Log.debug);
}

if (import.meta?.env?.MODE === 'test') {
  Log.setLogLevel(Log.warn);
}
