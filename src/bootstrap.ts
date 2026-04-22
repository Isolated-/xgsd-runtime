import {attachManagerLifecycleListeners, bindEventBusToLoggerManager} from './extension/lifecycle'
import {createRuntime} from './extension/util'
import {ConfigParser, Context, createContext} from './config'
import * as Joi from 'joi'
import {SourceData} from '@xgsd/engine'
import {EventBus, EventBusAdapter} from './event'
import {Orchestrator} from './orchestrator'
import {Manager} from './types/generics/manager.interface'
import {ExecutorInput, LoggerInput, PluginInput} from './types/factory.types'

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
  loggers?: LoggerInput[]
  plugins?: PluginInput[]
  executor?: ExecutorInput
}

export type RuntimePresetFunction = () => RuntimePreset
export type RuntimePresetFilterFunction = (preset: RuntimePreset, filterArgs: {}) => RuntimePreset

// TODO: remove EventEmitter2 as a dependency
export const bootstrap = async (opts: {
  id: () => string
  packagePath: string
  configPath: string
  preset: RuntimePreset
  stream: EventBusAdapter
}) => {
  const {packagePath, configPath, preset, stream, id} = opts

  const bus = new EventBus(stream)

  const schema = Joi.object()
  const config = new ConfigParser(configPath)
    .load()
    .parse()
    .default({
      mode: 'async',
      concurrency: 4,
      blocks: [],
    })
    .validate((input) => schema.validate(input).value)
    .build() as {project: any; blocks: any[]} // <- fix this up

  const ctx = createContext(packagePath)
    .config(config)
    .bus(bus)
    .id(id)
    .name()
    .version()
    .data()
    .mode()
    .env()
    .concurrency(config.project.concurrency)
    .blocks()
    .blockCount()
    .build()

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

  // stop merging input data (config no longer has top-level data)
  await orchestrator.orchestrate(config.project.data)

  // clean this up
  await dispatchToManagers({
    ctx,
    managers: [loggerManager, pluginManager],
    type: 'exit',
  })
}
