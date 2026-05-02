import {PluginRegistry} from './plugins/plugin.registry'
import {PluginManager} from './plugins/plugin.manager'
import {ExecutorInput, OrchestratorInput, PluginInput} from '../types/factory.types'
import {resolveFactory, resolveOrchestrator} from './util'
import {Hooks} from '../types/hooks.types'
import {EventBus, EventBusAdapter} from '../event'
import {Executor} from '../types/generics/executor.interface'
import {Orchestrator} from '../types/generics/orchestrator.interface'
import {FatalError, FatalErrorCode} from '../error'
import {UserHooksPlugin} from './plugins/builtin/userhooks.plugin'
import {Context} from '../types/context.types'

export type SetupOpts = {
  // di
  pluginRegistry?: PluginRegistry

  bus?: EventBus<EventBusAdapter>
}

export class SetupContainer {
  private pluginRegistry: PluginRegistry
  private bus: EventBus<EventBusAdapter>

  private executorFactory?: (ctx: Context) => Executor
  private orchestratorFactory?: (ctx: Context) => (executor: Executor) => Orchestrator

  constructor(opts?: SetupOpts) {
    this.pluginRegistry = opts?.pluginRegistry || new PluginRegistry()
    this.bus = opts?.bus!
  }

  use(plugin: PluginInput) {
    this.pluginRegistry.use(plugin)
  }

  executor(input: ExecutorInput) {
    this.executorFactory = resolveFactory(input, {type: 'executor'})
  }

  orchestrator(input: OrchestratorInput) {
    this.orchestratorFactory = resolveOrchestrator(input, {type: 'orchestrator'}) as any
  }

  async build(context: Context): Promise<{
    pluginManager: PluginManager
    orchestrator: Orchestrator
    executor: Executor
  }> {
    this.pluginRegistry.use(UserHooksPlugin, true)

    const plugins: Hooks[] = this.pluginRegistry.build(context)
    //const loggers: Logger[] = this.loggerRegistry.build(context)

    const pluginManager = new PluginManager(plugins, this.bus)
    //const loggerManager = new LoggerManager(loggers, this.bus)

    if (!this.executorFactory) {
      throw new FatalError('an executor has not been configured, call .executor()', FatalErrorCode.NoExecutor)
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
      executor,
      orchestrator,
    }
  }
}
