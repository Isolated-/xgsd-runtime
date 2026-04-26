import {SetupContainer} from './setup'
import {EventHandler} from './lifecycle'
import {PluginRegistry} from './plugins/plugin.registry'
import {LoggerRegistry} from './loggers/logger.registry'
import {Block, Context} from '../config'
import {RunFn, SourceData} from '@xgsd/engine'
import {Hooks} from '../types/hooks.types'
import {FatalError, FatalErrorCode} from '../error'
import {EventBus, EventBusAdapter} from '../event'
import {SystemEvent} from '../types/events.types'
import {FactoryInput, Factory, OrchestratorInput, OrchestratorFactory} from '../types/factory.types'
import {RuntimePreset} from '../bootstrap'
import {join} from 'path'
import {UserModule} from './user-module'
import {Executor} from '../types/generics/executor.interface'
import {Orchestrator} from '../types/generics/orchestrator.interface'

export type UserSetupFn = (mod: UserModule, setup: SetupContainer) => Promise<void>
export type ContextLike = {
  packagePath: string
  entry: string
  blockCount: number
}

// super simple map cache
const moduleCache = new Map<string, UserModule>()

export async function importUserModule<T extends ContextLike = ContextLike>(context: T) {
  if (moduleCache.has(context.entry)) {
    return moduleCache.get(context.entry)
  }

  try {
    const mod = await import(context.entry)
    moduleCache.set(context.entry, mod)

    return mod
  } catch (e: any) {
    // clean this up
    throw new FatalError(
      `${context.entry} couldn't be loaded. This could mean it wasn't found, or there's an error preventing its load. Check logs for more information. (${e.message})`,
      FatalErrorCode.ModuleNotFound,
    )
  }
}

export async function importUserModuleRunFn<T extends ContextLike = ContextLike>(
  block: Block,
  context: T,
): Promise<RunFn<SourceData>> {
  const mod = await importUserModule(context)

  if (!mod[block.run]) {
    throw new FatalError(`function ${block.run} does not exist in module`, FatalErrorCode.FunctionNotFound)
  }

  if (typeof mod[block.run] !== 'function') {
    throw new FatalError(`${block.run} is not a function`, FatalErrorCode.FatalError)
  }

  return mod[block.run] as RunFn<SourceData>
}

export type ExtensionType = 'plugin' | 'logger' | 'executor' | 'orchestrator'
export type Extension = {
  name?: string
  core?: boolean
  type?: ExtensionType
  init?: (ctx: any) => Promise<void> | void
  exit?: (ctx: any) => Promise<void> | void
  on?: (e: string, handler: EventHandler) => void
}

export const runInit = async <T extends Extension>(items: T[], ctx: Context, bus?: EventBus<EventBusAdapter>) => {
  for (const item of items) {
    if (item.init) {
      await item.init(ctx)
    }

    if (bus) {
      await bus.emit<SystemEvent.ExtensionLoaded>(SystemEvent.ExtensionLoaded, {
        name: item.name ?? 'anonymous',
        core: !!item.core,
        type: item.type!,
      })
    }
  }
}

export const runExit = async <T extends Extension>(items: T[], ctx: Context, bus?: EventBus<EventBusAdapter>) => {
  for (const item of items) {
    if (item.exit) {
      await item.exit(ctx)
    }

    if (bus) {
      await bus.emit<SystemEvent.ExtensionUnloaded>(SystemEvent.ExtensionUnloaded, {
        name: item.name ?? 'anonymous',
        core: !!item.core,
        type: item.type!,
      })
    }
  }
}

export const resolveOrchestrator = (input: OrchestratorInput, opts?: {type: ExtensionType; core?: boolean}) => {
  return (ctx: Context) => {
    return (executor: Executor) => {
      const instance =
        typeof input === 'function'
          ? (() => {
              try {
                return new (input as any)(ctx, executor)
              } catch {
                return (input as any)(ctx, executor)
              }
            })()
          : input

      const name =
        instance?.name ||
        instance?.constructor?.name ||
        (typeof input === 'function' ? input.name : undefined) ||
        'anonymous'

      if (instance && typeof instance === 'object') {
        instance.name = name
        instance.type = opts?.type
        instance.core = opts?.core ?? false
      }

      return instance
    }
  }
}

export const resolveFactory = <T = unknown>(
  input: FactoryInput<T>,
  opts?: {
    type: ExtensionType
    core?: boolean
  },
) => {
  return (ctx: Context) => {
    const instance =
      typeof input === 'function'
        ? (() => {
            try {
              return new (input as any)(ctx)
            } catch {
              return (input as any)(ctx)
            }
          })()
        : input

    const name =
      instance?.name ||
      instance?.constructor?.name ||
      (typeof input === 'function' ? input.name : undefined) ||
      'anonymous'

    if (instance && typeof instance === 'object') {
      instance.name = name

      instance.type = opts?.type
      instance.core = opts?.core ?? false
    }

    return instance
  }
}

export const buildFactories = <T = unknown>(factories: Factory<T>[], ctx: Context) => {
  // this fixes user errors like:
  // xgsd.use((ctx) => {}) (no returns)
  // by dropping the plugin before its registered
  return factories
    .map((f) => {
      try {
        return f(ctx)
      } catch {
        return undefined
      }
    })
    .filter((factory): factory is T => !!factory)
}

export const loadUserSetup = async (userModule: UserModule, setup: SetupContainer) => {
  if (typeof userModule.setup === 'function') {
    const opts = await userModule.setup(setup)
    return opts
  }
}

/**
 *
 *  @param {WorkflowContext} opts.context
 *  @param {PluginInput[]} opts.plugins
 *  @param {ExecutorInput} opts.executor
 *  @param {SetupContainer} opts.setupContainer
 *  @param {UserSetupFn} opts.userCodeFn
 *  @returns
 */
export const createRuntime = async (opts: {
  bus?: EventBus<EventBusAdapter>
  ctx: Context
  preset: RuntimePreset
  setupContainer?: SetupContainer
  userCodeFn?: UserSetupFn
}) => {
  const pluginRegistry = new PluginRegistry()
  const loggerRegistry = new LoggerRegistry()

  const {ctx, preset} = opts

  preset.plugins?.forEach((plugin) => pluginRegistry.use(plugin, true))
  preset.loggers?.forEach((logger) => loggerRegistry.use(logger, true))

  const setup =
    opts.setupContainer ??
    new SetupContainer({
      bus: opts.bus,
      pluginRegistry,
      loggerRegistry,
    })

  // this needs to happen before userCode is called or preset will always win
  if (preset.executor) {
    setup.executor(preset.executor)
  }

  if (preset.orchestrator) {
    setup.orchestrator(preset.orchestrator)
  }

  // remove this just depend on userCodeFn
  const userModule = await importUserModule(ctx)
  const userCodeFn = opts.userCodeFn ?? loadUserSetup

  try {
    await userCodeFn(userModule, setup)
  } catch (error) {
    // TODO: determine how to handle this cleanly
  }

  return setup.build(ctx)
}

export const emit = async <T = unknown>(hooks: Hooks[], event: string, payload: T) => {
  for (const hook of hooks) {
    if (!hook.on || typeof hook.on !== 'function') continue
    if (hook.events && !hook.events.includes(event)) continue

    await hook.on(event, payload)
  }
}
