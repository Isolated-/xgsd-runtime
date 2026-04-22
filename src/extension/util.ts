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
import {FactoryInput, Factory} from '../types/factory.types'
import {RuntimePreset} from '../bootstrap'
import {join} from 'path'

export type UserSetupFn = (ctx: Context, setup: SetupContainer) => Promise<void>
export type ContextLike = {
  packagePath: string
  blockCount: number
}

export async function importUserModule<T extends ContextLike = ContextLike>(context: T) {
  try {
    const mod = await import(join(context.packagePath, 'index.js'))
    return mod
  } catch (e: any) {
    // clean this up
    throw new FatalError(
      `${context.packagePath} couldn't be loaded. This could mean it wasn't found, or there's an error preventing its load. Check logs for more information. (${e.message})`,
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

export type Lifecycle = {
  name?: string
  init?: (ctx: any) => Promise<void> | void
  exit?: (ctx: any) => Promise<void> | void
}

export type ExtensionType = 'plugin' | 'logger'
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
        name: item.name!,
        core: !!item.core,
        type: item.type!,
      })
    }
  }
}

export const resolveFactory = <T = unknown>(
  input: FactoryInput<T>,
  opts?: {
    type: 'logger' | 'plugin' | 'executor'
    core?: boolean
    env?: 'dev' | 'test' | 'production'
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
      instance.env = opts?.env ?? 'dev'
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

export const loadUserSetup = async (context: Context, setup: SetupContainer) => {
  const userModule = await importUserModule(context)

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

  const userCodeFn = opts.userCodeFn ?? loadUserSetup

  await userCodeFn(ctx, setup)

  if (preset.executor) {
    setup.executor(preset.executor)
  }

  return setup.build(ctx)
}

export const emit = async <T = unknown>(hooks: Hooks[], _: string, payload: T) => {
  for (const hook of hooks) {
    if (!hook.on || typeof hook.on !== 'function') continue

    await hook.on(payload)
  }
}
