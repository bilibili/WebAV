import { ReadableStream } from 'web-streams-polyfill/ponyfill'

import { beforeAll, expect, test, vi } from 'vitest'
import { SourceGroup } from '../source-group'

;(global as any).ReadableStream = ReadableStream

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

test('SourceGroup concat', async () => {
  const sg = new SourceGroup()
  // createRS()
  sg.add({ start: 0, end: 100 }, createRS())
  sg.add({ start: 100, end: 200 }, createRS())
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
