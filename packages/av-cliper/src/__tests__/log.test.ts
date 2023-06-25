import { vi, expect, test } from 'vitest'
import { Log } from '../log'

const errorSpy = vi.spyOn(console, 'error')
const warnSpy = vi.spyOn(console, 'warn')
const infoSpy = vi.spyOn(console, 'info')
const debugSpy = vi.spyOn(console, 'debug')
test('log threshold', () => {
  Log.setLogLevel(Log.debug)
  Log.debug('log test')
  expect(debugSpy).toHaveBeenCalledWith('log test')
  debugSpy.mockReset()

  Log.setLogLevel(Log.error)
  Log.debug('log test')
  Log.info('log test')
  Log.warn('log test')
  Log.error('log test')
  expect(errorSpy).toHaveBeenCalledWith('log test')
  expect(warnSpy).not.toHaveBeenCalled()
  expect(infoSpy).not.toHaveBeenCalled()
  expect(debugSpy).not.toHaveBeenCalled()
})
