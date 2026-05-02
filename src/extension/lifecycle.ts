import {ProjectEvent, BlockEvent, SystemEvent} from '../types/events.types'
import {Manager} from '../types/generics/manager.interface'
import {EventBus, EventBusAdapter} from '../event'
import {normaliseContext} from '../builders/context.builder'

export const EVENT_MAP = {
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
  [SystemEvent.SystemMessage]: SystemEvent.SystemMessage,
}

export type EventHandler<T = unknown> = (payload: T) => void | Promise<void>

export const cleanEventPayload = (payload: any) => {
  // drop bus from Context

  if (!payload.context) {
    return payload
  }

  payload.context = normaliseContext(payload.context)

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
