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

export class DefaultOrchestrator implements Orchestrator {
  constructor(
    private ctx: Context,
    private executor: Executor,
  ) {}

  async orchestrate(data: SourceData, blocks: Block[]): Promise<Block[]> {
    const ctx = this.ctx
    const {config} = ctx

    const userModule = await importUserModule(ctx)

    await ctx.bus.emit<ProjectEvent.Started>(ProjectEvent.Started, {
      context: ctx,
    })

    let concurrency = config.project?.concurrency as number
    if (ctx.mode === 'chain' || ctx.mode === 'fanout') {
      concurrency = 1
    }

    let input = deepmerge2({}, data) as Record<string, any>
    const results = await executeBlocks<Block>(
      input as any,
      config.blocks as any,
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

        const result = await this.executor.run(block, ctx)

        if (result.state === RunState.Failed) {
          await ctx.bus.emit(BlockEvent.Failed, {
            block,
            error: block.error,
          })
        }

        return result as Block
      },
    )

    await ctx.bus.emit<ProjectEvent.Ended>(ProjectEvent.Ended, {
      output: results,
      context: {
        ...ctx,
        state: RunState.Completed,
        end: new Date().toISOString(),
      },
    })

    return results
  }
}
