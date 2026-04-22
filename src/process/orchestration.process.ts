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

  // concurrency must already be defined by now
  // no need to check modes and re-assign it
  const concurrency = options.concurrency
  const results: T[] = []
  let data = input

  await runWithConcurrency(runnables, concurrency!, async (block) => {
    // in all modes, the input is merged with config data
    // config data != block input data
    block.input = deepmerge2(block.input, data) as SourceData

    const result = await run(block)

    // chain mode is a special case
    // where output data becomes input data of next block
    // additionally, like all other blocks
    // "data" (comes from config) is merged with the output
    // so that top-level data isn't lost
    if (options.mode === 'chain') {
      data = deepmerge2(data, result.output!)
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
