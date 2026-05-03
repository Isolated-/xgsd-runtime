import {FatalError, FatalErrorCode} from '../../../error'
import {Context} from '../../../types/context.types'
import {ProjectEvent, BlockEvent, SystemEvent} from '../../../types/events.types'
import {Plugin} from '../../../types/interfaces/plugin.interface'

const eventToHookMap = {
  // project events
  [ProjectEvent.Started]: 'onProjectStart',
  [ProjectEvent.Ended]: 'onProjectEnd',

  // block events
  [BlockEvent.Started]: 'onBlockStart',
  [BlockEvent.Ended]: 'onBlockEnd',
  [BlockEvent.Retrying]: 'onBlockRetry',
  [BlockEvent.Skipped]: 'onBlockSkip',
  [BlockEvent.Waiting]: 'onBlockWait',
  [BlockEvent.Failed]: 'onBlockFail',

  // system events
  [SystemEvent.ExtensionLoaded]: 'onExtensionLoad',
  [SystemEvent.ExtensionUnloaded]: 'onExtensionUnload',
} as const

type ContextLike = {
  packagePath: string
  blockCount: number
}

async function importUserModule<T extends ContextLike = ContextLike>(context: T) {
  try {
    const mod = await import(context.packagePath)
    return mod
  } catch (e: any) {
    // clean this up
    throw new FatalError(
      `${context.packagePath} couldn't be loaded. This could mean it wasn't found, or there's an error preventing its load. Check logs for more information. (${e.message})`,
      FatalErrorCode.ModuleNotFound,
    )
  }
}

export class UserHooksPlugin implements Plugin {
  private module: any

  constructor(private readonly opts: Record<string, unknown>) {}

  async init(context: Context): Promise<void> {
    this.module = await importUserModule({packagePath: context.projectPath, blockCount: context.blockCount})
  }

  private async callHook(data: {event: keyof typeof eventToHookMap; payload: unknown}) {
    // drop the envelope when calling hooks
    const {event, payload} = data

    const fnName = eventToHookMap[event]

    const fn = this.module?.[fnName]

    if (typeof fn !== 'function') return

    try {
      await fn(payload)
    } catch (error: any) {
      // Don't crash the system — log instead
      console.error(`[UserCodeHook] ${fnName} failed: ${error.message}`)
    }
  }

  async on(event: any, payload: any): Promise<void> {
    await this.callHook({event, payload})
  }
}
