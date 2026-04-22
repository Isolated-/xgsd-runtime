import {RunState} from '../types/state.types'
import {FatalError, FatalErrorCode} from '../error'
import {BlockEvent} from '../types/events.types'
import {retry, WrappedError, RetryAttempt, SourceData, withTimeout} from '@xgsd/engine'
import {getBackoffStrategy} from '../backoff'
import {Events} from '../types/events.types'
import {Block, Context} from '../config'
import {ContextLike, importUserModuleRunFn} from '../extension/util'
import {defaultWith, delayFor} from '../util/misc.util'

export const DATA_SIZE_LIMIT_KB = 2048 // 2048 KB

export const log = (message: string, level: string = 'info') => {
  dispatchMessage('log', {log: {level, message, timestamp: new Date().toISOString()}}, true)
}

export function getStepDelay(stepCount: number): number {
  if (stepCount <= 0) return 0

  const base = 100 // ms max delay
  const min = 10 // ms minimum delay floor

  // Scale down with log — more steps = smaller delay
  const delay = base / Math.log2(stepCount + 1)

  // Clamp so we never go below min
  return Math.max(min, Math.round(delay))
}

function dispatchMessage(
  type: 'error' | 'start' | 'result' | 'attempt' | 'log' | 'event',
  payload: any,
  child: boolean = false,
) {
  process.send!({
    type: `CHILD:${type.toUpperCase()}`,
    ...payload,
  })
}

const event = async <K extends keyof Events>(name: keyof Events, payload: Events[K]) => {
  process.send!({
    type: 'CHILD:EVENT',
    event: name,
    payload,
  })
}

export async function processBlock(opts: {
  block: Block<SourceData>
  event?: (
    name: string,
    payload: {
      block: Block
      attempt?: RetryAttempt
      ctx?: Context
    },
  ) => void
  attempt?: (attempt: RetryAttempt) => Promise<void>
}) {
  const {event, attempt, block} = opts

  block.start = new Date().toISOString()

  if (block.enabled === false) {
    // handle skip
    block.state = RunState.Skipped
    event?.(BlockEvent.Skipped, {block})
    event?.(BlockEvent.Ended, {block})
    return block
  }

  event?.(BlockEvent.Started, {block})

  if (block.options?.delay && block.options.delay !== '0s' && block.options.delay !== 0) {
    //const delayMs = getDurationNumber(block.options.delay as string) || 0
    //event?.(BlockEvent.Waiting, {block, delayMs})
    //await delayFor(delayMs || 0)
  }

  const method = defaultWith('exponential', block.options?.backoff)
  const delayFn = getBackoffStrategy(method as string)
  const options = block.options!

  block.state = RunState.Running

  // TODO: remove hardcoded defaults
  const retries = options.retries
  // by this point timeout = number
  const timeout = options.timeout as number

  let errors: WrappedError[] = []
  const result = await retry(block.input, block.fn!, retries, {
    timeoutWrapper: withTimeout(timeout),
    backoff: delayFn,
    onAttempt: async (a) => {
      attempt?.(a)
      block.state = RunState.Retrying
      block.attempt = a.attempt + 1
      errors.push(a.error) // this can be removed in v0.4+ (streaming to logs is implemented)
      event?.(BlockEvent.Retrying, {block, attempt: a})
    },
  })

  if (errors.length > 0) {
    block.errors = errors
  }

  block.output = (result.data as SourceData) ?? {}
  block.error = result.error
  block.options = {retries, timeout}
  block.state = result.error ? RunState.Failed : RunState.Completed
  block.end = new Date().toISOString()
  block.duration = Date.parse(block.end) - Date.parse(block.start)

  event?.(BlockEvent.Ended, {block})

  return block
}

export const rejectionHandler = (block: Block) => {
  const handler = (errorOrRejection: any) => {
    const error = errorOrRejection instanceof Error ? errorOrRejection : null
    const wrapped = new FatalError(
      error?.message || String(errorOrRejection || 'Unhandled Exception'),
      FatalErrorCode.FatalError,
    ) as WrappedError

    const result = {
      block: {
        ...block,
        state: RunState.Failed,
        error: wrapped,
        errors: [...(block.errors || []), wrapped],
      },
    }

    dispatchMessage('result', {result})
  }

  process.on('uncaughtException', handler)
  process.on('unhandledRejection', handler)
}

// this method now just deals with logging back up stream
process.on('message', async (msg: {type: string; block: Block; ctx: ContextLike}) => {
  if (msg.type !== 'START') return

  const {block, ctx} = msg

  rejectionHandler(block)

  const fn = await importUserModuleRunFn(block, ctx)
  block.fn = fn

  log(`[${block.run}] function ${block.fn}`, 'debug')

  const result = await processBlock({
    block,
    event,
  })

  // v0.4.0 - allow some time for messages to be sent before exiting
  // also prevents issues with very fast steps
  // placing it here won't affect step timing
  // v0.5.0 (note) -> ctx.blocks is no longer sent to child process
  // instead blockCount() can achieve this function
  const nextStepDelayMs = getStepDelay(ctx.blockCount)
  await delayFor(nextStepDelayMs)

  dispatchMessage('result', {result: {block: result}})
})
