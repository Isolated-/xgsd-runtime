import {InProcessExecutor} from '../executors/in-process.executor'
import {ProcessExecutor} from '../executors/process.executor'
import {PluginRegistry} from './plugins/plugin.registry'
import {PluginManager} from './plugins/plugin.manager'
import {ExecutorInput, LoggerInput, PluginInput} from '../types/factory.types'
import {resolveFactory} from './util'
import {LoggerRegistry} from './loggers/logger.registry'
import {LoggerManager} from './loggers/logger.manager'
import {Context} from '../config'
import {Hooks} from '../types/hooks.types'
import {Logger} from '../types/interfaces/logger.interface'
import {EventBus, EventBusAdapter} from '../event'
import {Executor} from '../types/generics/executor.interface'

export type SetupOpts = {
  // di
  pluginRegistry?: PluginRegistry
  loggerRegistry?: LoggerRegistry

  bus?: EventBus<EventBusAdapter>
}

export class SetupContainer {
  private pluginRegistry: PluginRegistry
  private loggerRegistry: LoggerRegistry
  private bus: EventBus<EventBusAdapter>

  private executorFactory?: (ctx: Context) => Executor

  constructor(opts?: SetupOpts) {
    this.pluginRegistry = opts?.pluginRegistry || new PluginRegistry()
    this.loggerRegistry = opts?.loggerRegistry || new LoggerRegistry()
    this.bus = opts?.bus!
  }

  use(plugin: PluginInput) {
    this.pluginRegistry.use(plugin)
  }

  logger(logger: LoggerInput) {
    this.loggerRegistry.use(logger)
  }

  executor(input: ExecutorInput) {
    this.executorFactory = resolveFactory(input, {type: 'executor'})
  }

  async build(context: Context): Promise<{
    pluginManager: PluginManager
    loggerManager: LoggerManager
    executor: Executor
  }> {
    // TODO: this line shouldn't be here anymore
    // presets are configured/controlled by apps
    const defaultExecutor = context.lite === true ? new InProcessExecutor() : new ProcessExecutor()

    const plugins: Hooks[] = this.pluginRegistry.build(context)
    const loggers: Logger[] = this.loggerRegistry.build(context)

    const pluginManager = new PluginManager(plugins, this.bus)
    const loggerManager = new LoggerManager(loggers, this.bus)

    const executor = this.executorFactory ? this.executorFactory(context) : defaultExecutor

    return {
      pluginManager,
      loggerManager,
      executor,
    }
  }
}
