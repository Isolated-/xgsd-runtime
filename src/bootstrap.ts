import {attachManagerLifecycleListeners, bindEventBusToLoggerManager} from './extension/lifecycle'
import {createRuntime} from './extension/util'
import {BlockContext, Context} from './config'
import {SourceData} from '@xgsd/engine'
import {EventBus, EventBusAdapter} from './event'
import {Manager} from './types/generics/manager.interface'
import {ExecutorInput, LoggerInput, OrchestratorInput, PluginInput} from './types/factory.types'
import {ExecutionMode} from './process/orchestration.process'
import {ProjectEvent} from './types/events.types'

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

export type RuntimePreset = {
  // mode/concurrency aren't currently supported
  // but should be to represent the parts of config
  // that the runtime is specifically concerned about
  mode?: ExecutionMode
  concurrency?: number
  loggers?: LoggerInput[]
  plugins?: PluginInput[]
  executor?: ExecutorInput
  orchestrator?: OrchestratorInput
}

export type RuntimePresetFunction = () => RuntimePreset

export const bootstrap = async <T extends SourceData>(opts: {
  ctx: Context<T>
  preset: RuntimePreset
  stream: EventBusAdapter
}) => {
  const {preset, stream, ctx} = opts

  const bus = new EventBus(stream)

  const {pluginManager, loggerManager, orchestrator} = await createRuntime({
    ctx,
    bus,
    preset,
  })

  bindEventBusToLoggerManager(bus, loggerManager)
  attachManagerLifecycleListeners(pluginManager, bus)

  await dispatchToManagers({
    ctx,
    managers: [loggerManager, pluginManager],
    type: 'init',
  })

  await orchestrator.orchestrate(ctx.data, ctx.blocks as any[])

  await dispatchToManagers({
    ctx,
    managers: [loggerManager, pluginManager],
    type: 'exit',
  })
}
