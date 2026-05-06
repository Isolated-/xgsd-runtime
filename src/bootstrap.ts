import {attachManagerLifecycleListeners} from './extension/lifecycle'
import {createRuntime} from './extension/util'
import {SourceData} from '@xgsd/engine'
import {EventBus} from './event'
import {Manager} from './types/generics/manager.interface'
import {ProjectEvent, SystemEvent} from './types/events.types'
import {RunState} from './types/state.types'
import {ProjectConfig} from './types/config.types'
import EventEmitter2 from 'eventemitter2'
import {createContext} from './sdk'
import {Activation, Context} from './types/context.types'
import {RuntimePreset} from './types/runtime-preset.types'

export const dispatchToManagers = async (opts: {
  managers: Manager[]
  type: 'init' | 'exit'
  ctx: Context<SourceData>
}) => {
  const {managers, type, ctx} = opts

  for (const manager of managers) {
    await manager[type](ctx)
  }
}

type BootstrapOpts<T extends SourceData> = {
  projectPath: string
  config: ProjectConfig
  activation?: Activation
  data?: T
  ctx?: Context<T>
  bus?: EventBus<any>
  preset: RuntimePreset
  spanStart?: number
  [key: string]: unknown
}

export const bootstrap = async <T extends SourceData>(opts: BootstrapOpts<T>) => {
  const activation = opts.activation ?? 'cli'
  const start = opts.spanStart ?? performance.now()

  const {config, projectPath, preset} = opts
  const bus = opts.bus ?? opts.ctx?.bus ?? new EventBus(new EventEmitter2({wildcard: true}))

  const ctx =
    opts.ctx ??
    createContext({
      path: projectPath,
      config,
      bus,
      data: opts.data ?? config.data ?? null,
      activation,
    })

  ctx.start = new Date().toISOString()

  const {pluginManager, orchestrator} = await createRuntime({
    ctx,
    bus,
    preset,
  })

  attachManagerLifecycleListeners(pluginManager, bus)

  // this has to be here otherwise plugins/loggers never get this event
  await bus.emit(SystemEvent.Started, {summary: null})

  await dispatchToManagers({
    ctx,
    managers: [pluginManager],
    type: 'init',
  })

  await bus.emit(ProjectEvent.Started, {
    context: {
      ...ctx,
      state: RunState.Running,
    },
  })

  const projectStart = performance.now()
  const finalCtx = await orchestrator.orchestrate(ctx.data, ctx.blocks as any[])
  const projectEnd = performance.now()

  await bus.emit(ProjectEvent.Ended, {
    context: finalCtx,
    output: finalCtx.blocks,
  })

  await dispatchToManagers({
    ctx,
    managers: [pluginManager],
    type: 'exit',
  })

  const projectDuration = projectEnd - projectStart
  const ended = performance.now()
  const duration = ended - start

  await bus.emit(SystemEvent.Ended, {
    summary: null,
    bootstrapDuration: duration,
    projectDuration,
  })

  // instead of results
  // formalise a report summary
  return finalCtx
}
