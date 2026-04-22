import {attachManagerLifecycleListeners, bindEventBusToLoggerManager} from './extension/lifecycle'
import {createRuntime} from './extension/util'
import {ConfigParser, Context, createContext} from './config'
import * as Joi from 'joi'
import {SourceData} from '@xgsd/engine'
import {EventBus, EventBusAdapter} from './event'
import {Orchestrator} from './orchestrator'
import {Manager} from './types/generics/manager.interface'
import {ExecutorInput, LoggerInput, PluginInput} from './types/factory.types'
import {ExecutionMode} from './process/orchestration.process'

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
}

export type RuntimePresetFunction = () => RuntimePreset

export const bootstrap = async <T extends SourceData>(opts: {
  ctx: Context<T>
  preset: RuntimePreset
  stream: EventBusAdapter
}) => {
  const {preset, stream, ctx} = opts

  const bus = new EventBus(stream)

  const {pluginManager, loggerManager, executor} = await createRuntime({
    ctx,
    bus,
    preset,
  })

  const orchestrator = new Orchestrator(ctx, executor as any, bus)

  bindEventBusToLoggerManager(bus, loggerManager)
  attachManagerLifecycleListeners(pluginManager, bus)

  //  await executor.init?.(ctx as ProjectContext)
  await dispatchToManagers({
    ctx,
    managers: [loggerManager, pluginManager],
    type: 'init',
  })

  // orchestrator could return output data
  // config.project.data should become data
  await orchestrator.orchestrate(ctx.data)

  // clean this up
  await dispatchToManagers({
    ctx,
    managers: [loggerManager, pluginManager],
    type: 'exit',
  })
}
