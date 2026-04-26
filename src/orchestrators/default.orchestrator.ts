import {SourceData} from '@xgsd/engine'
import {Orchestrator} from '../types/generics/orchestrator.interface'
import {Block, Context} from '../config'
import {importUserModule} from '../extension/util'
import {deepmerge2} from '../util/object.util'
import {executeBlocks, ExecutionMode} from '../process/orchestration.process'
import {Executor} from '../types/generics/executor.interface'
import {FatalError} from '../error'
import {BlockEvent, ProjectEvent} from '../types/events.types'
import {RunState} from '../types/state.types'
import {interpolate} from '../process/block.process'

// resolve block templates
function resolveBlockTemplateFromObject(object: Record<string, any>, data: Record<string, any>): any {
  if (typeof object === 'string') {
    return interpolate(object, data)
  }

  if (Array.isArray(object)) {
    return object.map((item) => resolveBlockTemplateFromObject(item, data))
  }

  if (typeof object === 'object' && object !== null) {
    const result: Record<string, any> = {}

    for (const [key, value] of Object.entries(object)) {
      result[key] = resolveBlockTemplateFromObject(value, data)
    }

    return result
  }

  return object
}

export class DefaultOrchestrator implements Orchestrator {
  constructor(
    private ctx: Context,
    private executor: Executor,
  ) {}

  async orchestrate(data: SourceData, blocks: Block[]): Promise<Block[]> {
    const ctx = this.ctx
    const {config} = ctx

    const userModule = await importUserModule(ctx)

    let concurrency = config.project?.concurrency as number
    if (ctx.mode === 'chain' || ctx.mode === 'fanout') {
      concurrency = 1
    }

    let input = deepmerge2({}, data) as SourceData
    const results = await executeBlocks<SourceData>(
      input,
      blocks as any[],
      {
        mode: ctx.mode as ExecutionMode,
        concurrency,
      },
      async (block: Block) => {
        block.fn = userModule[block.run]

        block.options = {
          timeout: 5000,
          retries: 5,
          ...block.options,
        }

        // TODO: tighten this
        block.input = resolveBlockTemplateFromObject(block.input, {ctx, block})
        block.env = resolveBlockTemplateFromObject(block.env, {ctx, block})

        const result = await this.executor.run(block, ctx)

        // TODO: move this elsewhere
        if (result.state === RunState.Failed) {
          await ctx.bus.emit(BlockEvent.Failed, {
            block: result as Block,
            error: result.error,
          })
        }

        return result as Block
      },
    )

    return results
  }
}
