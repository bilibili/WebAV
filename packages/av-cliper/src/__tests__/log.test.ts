import { vi, expect, test } from 'vitest'
import { Log } from '../log'

const errorSpy = vi.spyOn(console, 'error')
const warnSpy = vi.spyOn(console, 'warn')
const infoSpy = vi.spyOn(console, 'info')
const debugSpy = vi.spyOn(console, 'debug')
test('log threshold', () => {
  Log.setLogLevel(Log.debug)
  Log.debug(1)
  expect(debugSpy).toHaveBeenCalledWith(1)
  debugSpy.mockReset()

  Log.setLogLevel(Log.error)
  Log.debug(1)
  Log.info(1)
  Log.warn(1)
  Log.error(1)
  expect(errorSpy).toHaveBeenCalledWith(1)
  expect(warnSpy).not.toHaveBeenCalled()
  expect(infoSpy).not.toHaveBeenCalled()
  expect(debugSpy).not.toHaveBeenCalled()
})
