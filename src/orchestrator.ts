import {RunState} from './types/state.types'
import {executeBlocks, ExecutionMode, Runnable} from './process/orchestration.process'
import {ProjectEvent, BlockEvent} from './types/events.types'
import {Executor} from './types/generics/executor.interface'
import {FatalError} from './error'
import {EventBus, EventBusAdapter} from './event'
import {SourceData} from '@xgsd/engine'
import {Context} from './config'
import {Block} from './config'
import {deepmerge2} from './util/object.util'
import {importUserModule} from './extension/util'

export class Orchestrator {
  constructor(
    public context: Context,
    private executor: Executor,
    private bus: EventBus<EventBusAdapter>,
  ) {}

  async before(): Promise<void> {
    await this.event(ProjectEvent.Started, {context: this.context})
  }

  async event(name: ProjectEvent | BlockEvent, payload: any): Promise<void> {
    await this.bus.emit(name, payload)
  }

  async orchestrate(data: SourceData): Promise<void> {
    // fire start event
    await this.before()

    const ctx = this.context
    const {config} = ctx

    process.setMaxListeners(config.blocks.length + 10)

    // import user module here too
    const userModule = await importUserModule(this.context)
    let concurrency = config.project?.concurrency as number
    if (ctx.mode === 'chain' || ctx.mode === 'fanout') {
      concurrency = 1
    }

    let input = deepmerge2({}, data) as Record<string, any>

    // this was refactored to reduce duplication
    // and to fix issues caused by slightly different implementations
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

        const result = (await this.run(block as Block)) as Block

        // handle error/hard failures:
        if (result.error && result.error instanceof FatalError) {
          await this.event(BlockEvent.Failed, {
            name: result.name || result.run,
            data: result.input,
            error: result.error,
          })

          return result
        }

        if (result.state === RunState.Failed) {
          await this.event(BlockEvent.Failed, {
            name: result.name || result.run,
            data: result.input,
            error: result.error,
          })
        }

        return result
      },
    )

    await this.after(results)
  }

  async run(block: Block) {
    return this.executor.run(block, this.context as Context)
  }

  async after(results: Block[]): Promise<void> {
    // finalise context?
    const ctx = this.context

    ctx.state = RunState.Completed
    ctx.end = new Date().toISOString()

    await this.event(ProjectEvent.Ended, {
      context: ctx,
      output: results,
    })
  }
}
