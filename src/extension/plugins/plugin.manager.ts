import {Manager} from '../../types/generics/manager.interface'
import {Hooks} from '../../types/hooks.types'
import {emit, runExit, runInit} from '../util'
import {Context} from '../../config'
import {EventBus, EventBusAdapter} from '../../event'
import {EVENT_MAP} from '../lifecycle'
import {ProjectEvent} from '../../types/events.types'

export class PluginManager implements Manager {
  private ctx!: Context
  constructor(
    private plugins: Hooks[],
    private bus: EventBus<EventBusAdapter>,
  ) {}

  async init(ctx: Context): Promise<void> {
    this.ctx = ctx
    return runInit(this.plugins, ctx, this.bus)
  }

  async exit(ctx: Context): Promise<void> {
    return runExit(this.plugins, ctx, this.bus)
  }

  async emit(event: string, payload: any): Promise<void> {
    await emit(this.plugins, event, payload)
  }
}
