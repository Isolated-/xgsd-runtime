import {ProjectEvent, BlockEvent, SystemEvent} from '../types/events.types'
import {Manager} from '../types/generics/manager.interface'
import {LoggerManager} from './loggers/logger.manager'
import {EventBus, EventBusAdapter} from '../event'

const EVENT_MAP = {
  // project events
  [ProjectEvent.Started]: ProjectEvent.Started,
  [ProjectEvent.Ended]: ProjectEvent.Ended,

  // block events
  [BlockEvent.Started]: BlockEvent.Started,
  [BlockEvent.Ended]: BlockEvent.Ended,
  [BlockEvent.Retrying]: BlockEvent.Retrying,
  [BlockEvent.Skipped]: BlockEvent.Skipped,
  [BlockEvent.Waiting]: BlockEvent.Waiting,
  [BlockEvent.Failed]: BlockEvent.Failed,

  // system events
  [SystemEvent.ExtensionLoaded]: SystemEvent.ExtensionLoaded,
  [SystemEvent.ExtensionUnloaded]: SystemEvent.ExtensionUnloaded,
  [SystemEvent.Started]: SystemEvent.Started,
  [SystemEvent.Ended]: SystemEvent.Ended,
} as const

export type EventHandler<T = unknown> = (payload: T) => void | Promise<void>

export const cleanEventPayload = (payload: any) => {
  // drop bus from Context

  if (!payload.context) {
    return payload
  }

  const {bus, ...context} = payload.context
  payload.context = {
    ...context,
  }

  return payload
}

/**
 *  Attaches listeners for incoming events used by Extensions
 *
 *  @param {Manager} manager
 *  @param {ProjectContext} context
 */
export const attachManagerLifecycleListeners = (manager: Manager, bus: EventBus<EventBusAdapter>) => {
  const disposers: Array<() => void> = []

  for (const [event, handler] of Object.entries(EVENT_MAP)) {
    const off = bus.on(event as any, async (e: any) => {
      const payload = e?.payload ?? {}

      await manager.emit(event, cleanEventPayload(payload))
    })

    disposers.push(off)
  }

  // return cleanup so lifecycle can be detached
  return () => {
    for (const off of disposers) off()
  }
}

export const bindEventBusToLoggerManager = (bus: EventBus<EventBusAdapter>, manager: LoggerManager) => {
  const disposers: Array<() => void> = []

  const off = bus.on('*.*', async ({event, payload}) => {
    await manager.log(event, cleanEventPayload(payload))
  })

  disposers.push(off)

  return () => {
    for (const off of disposers) off()
  }
}
