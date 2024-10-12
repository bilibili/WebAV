import { expect, test, vi } from 'vitest';
import { EventTool } from '../event-tool';

test('event-tool', () => {
  const evtTool = new EventTool<{
    a: (str: string) => void;
    b: () => void;
  }>();

  const onA = vi.fn();
  const onB = vi.fn();
  evtTool.on('a', onA);
  const offB = evtTool.on('b', onB);
  offB();

  evtTool.emit('a', 'test');
  evtTool.emit('b');

  expect(onA).toBeCalledWith('test');
  expect(onB).not.toBeCalled();

  onA.mockClear();
  evtTool.destroy();

  evtTool.emit('a', 'test');
  expect(onA).not.toBeCalled();
});
