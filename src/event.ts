import {Events} from './types/events.types'

export type EventEnvelope<K extends string, T> = {
  event: K
  payload: T
  timestamp?: string
}

export type EventBusAdapter = {
  on: (event: string, handler: (...args: any[]) => void) => void
  once: (event: string, handler: (...args: any[]) => void) => void
  off: (event: string, handler: (...args: any[]) => void) => void
  emit: (event: string, payload: any) => any
}

export class EventBus<T extends EventBusAdapter, E extends Events = Events> {
  constructor(private stream: T) {}

  // -------------------------
  // SUBSCRIBE
  // -------------------------

  on<K extends keyof E>(event: K, handler: (e: EventEnvelope<K & string, E[K]>) => void | Promise<void>): () => void {
    const wrapped = async (payload: E[K]) => {
      await handler({
        ...(payload as any),
      })
    }

    this.stream.on(event as string, wrapped)

    return () => {
      this.stream.off(event as string, wrapped)
    }
  }

  once<K extends keyof E>(event: K, handler: (e: EventEnvelope<K & string, E[K]>) => Promise<void> | void): () => void {
    const wrapped = async (payload: E[K]) => {
      await handler({...(payload as any)})
    }

    this.stream.once(event as string, wrapped)
    return () => this.stream.off(event as string, wrapped)
  }

  off<K extends keyof E>(event: K, handler: (...args: any[]) => void): void {
    this.stream.off(event as string, handler)
  }

  // -------------------------
  // PUBLISH
  // -------------------------

  async emit<K extends keyof E>(event: K, payload: E[K]): Promise<void> {
    // already wrapped
    if (payload.payload) {
      await this.stream.emit(event as string, payload)
      return
    }

    // will wrap
    await this.stream.emit(event as string, {
      event,
      payload,
    })
  }

  // -------------------------
  // UTILS (optional passthrough)
  // -------------------------

  listenerCount?(event: keyof E): number
  removeAll?(): void
}
