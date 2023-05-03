import { ReadableStream } from 'web-streams-polyfill/ponyfill'

import { beforeAll, expect, test, vi } from 'vitest'
import { SourceGroup } from '../source-group'

import { MP4Source } from '../mp4-source';
(global as any).ReadableStream = ReadableStream

function createRS (): ReadableStream<any> {
  let timerId = 0
  return new ReadableStream({
    start (ctrl) {
      let i = 0
      timerId = window.setInterval(() => {
        if (i > 100) {
          clearInterval(timerId)
          ctrl.close()
          return
        }
        ctrl.enqueue({
          timestamp: i,
          data: Math.random()
        })
        i += 10
      }, 10)
    },
    cancel () {
      console.log('-------end---------')
      clearInterval(timerId)
    }
  })
}

beforeAll(() => {
  vi.useFakeTimers()
})

test('SourceGroup concat mp4', async () => {
  const sg = new SourceGroup()
  await sg.add(new MP4Source(createRS()))
  await sg.add(new MP4Source(createRS()))
  sg.start()
  const reader = sg.outputStream.getReader()
  const count = vi.fn()
  while (true) {
    vi.advanceTimersToNextTimer()
    const { done } = await reader.read()
    if (done) break
    count()
  }
  expect(count).toBeCalledTimes(22)
})
