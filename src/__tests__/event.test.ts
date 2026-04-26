import {EventBus} from '../event'

function createFakeStream() {
  const listeners: Record<string, Function[]> = {}

  return {
    on(event: string, fn: Function) {
      listeners[event] = listeners[event] || []
      listeners[event].push(fn)
    },
    off(event: string, fn: Function) {
      listeners[event] = (listeners[event] || []).filter((f) => f !== fn)
    },
    emit(event: string, payload: any) {
      for (const fn of listeners[event] || []) {
        fn(payload)
      }
    },
  }
}

describe('EventBus.on() wrapper bug regression', () => {
  test('off() removes wrapped handler (prevents duplicate execution)', async () => {
    const stream = createFakeStream()
    const bus = new EventBus(stream as any)

    const handler = jest.fn()

    const off = bus.on('ping', handler)

    // emit once → should call handler
    stream.emit('ping', {value: 1})
    expect(handler).toHaveBeenCalledTimes(1)

    // remove listener
    off()

    // emit again → should NOT call handler again
    stream.emit('ping', {value: 2})
    expect(handler).toHaveBeenCalledTimes(1)
  })
})
