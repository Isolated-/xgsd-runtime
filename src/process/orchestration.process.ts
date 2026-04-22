import {RunFn, runWithConcurrency, SourceData} from '@xgsd/engine'
import {Block, Context} from '../config'
import {deepmerge2} from '../util/object.util'

export type ExecutionMode = 'async' | 'chain' | 'fanout' | 'batched'

export interface ExecutionOptions {
  mode: ExecutionMode
  concurrency?: number // only applies to async
}

export type Runnable<T extends SourceData = SourceData> = {
  fn: RunFn<T>
  input?: Record<string, unknown> | null
  output?: Record<string, unknown> | null
}

/**
 *  provides a generic execution interface
 *  to execute projects/blocks
 *
 *  this is typically called in Orchestrator
 *  so there's no need to call it manually
 */
export async function executeRunnables<T extends Runnable<SourceData>, C extends Context>(args: {
  runnables: T[]
  input: Record<string, unknown>
  options: ExecutionOptions
  run: (runnable: T) => Promise<T>
}): Promise<T[]> {
  const {runnables, input, options, run} = args

  let concurrency = options.concurrency
  if (options.mode === 'chain' || options.mode === 'fanout') {
    concurrency = 1
  }

  let results: T[] = []
  let data = input

  await runWithConcurrency(runnables, concurrency!, async (block) => {
    block.input = deepmerge2(block.input, data) as SourceData

    const result = await run(block)

    // merge chained ouputs for next step input
    if (options.mode === 'chain') {
      data = deepmerge2(block.input, result.output) as any
    }

    results.push(result)
  })

  return results
}

export async function executeBlocks<T extends SourceData = SourceData>(
  input: T,
  blocks: Block[],
  options: ExecutionOptions,
  run: (block: Block) => Promise<Block>,
): Promise<Block[]> {
  return executeRunnables({
    input,
    runnables: blocks,
    options,
    run,
  })
}
