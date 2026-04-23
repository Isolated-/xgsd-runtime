import {PluginRegistry} from './plugins/plugin.registry'
import {PluginManager} from './plugins/plugin.manager'
import {ExecutorInput, LoggerInput, OrchestratorFactory, OrchestratorInput, PluginInput} from '../types/factory.types'
import {resolveFactory, resolveOrchestrator} from './util'
import {LoggerRegistry} from './loggers/logger.registry'
import {LoggerManager} from './loggers/logger.manager'
import {Context} from '../config'
import {Hooks} from '../types/hooks.types'
import {Logger} from '../types/interfaces/logger.interface'
import {EventBus, EventBusAdapter} from '../event'
import {Executor} from '../types/generics/executor.interface'
import {Orchestrator} from '../types/generics/orchestrator.interface'
import {FatalError, FatalErrorCode} from '../error'

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
  private orchestratorFactory?: (ctx: Context) => (executor: Executor) => Orchestrator

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

  orchestrator(input: OrchestratorInput) {
    this.orchestratorFactory = resolveOrchestrator(input, {type: 'orchestrator'}) as any
  }

  async build(context: Context): Promise<{
    pluginManager: PluginManager
    loggerManager: LoggerManager
    orchestrator: Orchestrator
    executor: Executor
  }> {
    const plugins: Hooks[] = this.pluginRegistry.build(context)
    const loggers: Logger[] = this.loggerRegistry.build(context)

    const pluginManager = new PluginManager(plugins, this.bus)
    const loggerManager = new LoggerManager(loggers, this.bus)

    if (!this.executorFactory) {
      throw new FatalError('an executor has not been configured, call .orchestrator()', FatalErrorCode.NoExecutor)
    }

    if (!this.orchestratorFactory) {
      throw new FatalError(
        'an orchestrator has not been configured, call .orchestrator()',
        FatalErrorCode.NoOrchestrator,
      )
    }

    const executor = this.executorFactory!(context)
    const orchestrator = this.orchestratorFactory!(context)(executor)

    return {
      pluginManager,
      loggerManager,
      executor,
      orchestrator,
    }
  }
}
