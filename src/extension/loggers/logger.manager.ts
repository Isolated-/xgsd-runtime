import {Manager} from '../../types/generics/manager.interface'
import {Logger} from '../../types/interfaces/logger.interface'
import {runExit, runInit} from '../util'
import {Context} from '../../config'
import {EventBus, EventBusAdapter} from '../../event'

export class LoggerManager implements Manager {
  constructor(
    private loggers: Logger[],
    private bus: EventBus<EventBusAdapter>,
  ) {}

  // this is plugin focused
  async emit(event: string, payload: any): Promise<void> {}

  async log(message: any): Promise<void> {
    let msg = message

    for (const logger of this.loggers) {
      const {event, payload} = message

      // unwrap wrapped events
      if (payload.payload) {
        msg = {
          event,
          payload: payload.payload,
        }
      }

      await logger.log(msg)
    }
  }

  async init(ctx: Context): Promise<void> {
    return runInit(this.loggers, ctx, this.bus)
  }

  async exit(ctx: Context): Promise<void> {
    return runExit(this.loggers, ctx, this.bus)
  }
}
