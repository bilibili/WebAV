import { vi, expect, test, beforeEach } from 'vitest';
import { Log } from '../log';

const errorSpy = vi.spyOn(console, 'error');
const warnSpy = vi.spyOn(console, 'warn');
const infoSpy = vi.spyOn(console, 'info');
const debugSpy = vi.spyOn(console, 'debug');

beforeEach(() => {
  Log.setLogLevel(Log.info);
  errorSpy.mockReset();
  warnSpy.mockReset();
  infoSpy.mockReset();
  debugSpy.mockReset();
});

test('dump log', async () => {
  const spys = (
    ['getHours', 'getMinutes', 'getSeconds', 'getMilliseconds'] as const
  ).map((methodName) => {
    const spy = vi.spyOn(Date.prototype, methodName);
    spy.mockReturnValue(0);
    return spy;
  });

  const historyStr = await Log.dump();
  Log.setLogLevel(Log.info);
  Log.info('log info');
  Log.warn('log warn');
  Log.error('log error');

  expect((await Log.dump()).replace(historyStr, '')).toMatchSnapshot();
  for (const s of spys) s.mockRestore();
});

test('log threshold', () => {
  Log.setLogLevel(Log.debug);
  Log.debug('log test');
  expect(debugSpy).toHaveBeenCalledWith('log test');
  debugSpy.mockReset();

  Log.setLogLevel(Log.error);
  Log.debug('log test');
  Log.info('log test');
  Log.warn('log test');
  Log.error('log test');
  expect(errorSpy).toHaveBeenCalledWith('log test');
  expect(warnSpy).not.toHaveBeenCalled();
  expect(infoSpy).not.toHaveBeenCalled();
  expect(debugSpy).not.toHaveBeenCalled();
});
