let threshold = 1

const map = new Map<Function, number>()

export const Log = {
  setLogLevel: <T extends Function>(logfn: T) => {
    threshold = map.get(logfn) ?? 1
  },
  debug: (...args: any[]) => {
    if (threshold <= 0) console.debug(...args)
  },
  info: (...args: any[]) => {
    if (threshold <= 1) console.info(...args)
  },
  warn: (...args: any[]) => {
    if (threshold <= 2) console.warn(...args)
  },
  error: (...args: any[]) => {
    if (threshold <= 3) console.error(...args)
  }
}
map.set(Log.debug, 0)
map.set(Log.info, 1)
map.set(Log.warn, 2)
map.set(Log.error, 3)

// if (import.meta.env.DEV) {
//   Log.setLogLevel(Log.debug)
// }
