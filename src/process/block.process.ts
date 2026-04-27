import {RunState} from '../types/state.types'
import {FatalError, FatalErrorCode} from '../error'
import {BlockEvent} from '../types/events.types'
import {retry, WrappedError, RetryAttempt, SourceData, withTimeout} from '@xgsd/engine'
import {getBackoffStrategy} from '../backoff'
import {Events} from '../types/events.types'
import {Block, Context, ResultBuilder} from '../config'
import {ContextLike, importUserModuleRunFn} from '../extension/util'
import {defaultWith, delayFor} from '../util/misc.util'

export const log = (message: string, level: string = 'info') => {
  dispatchMessage('log', {log: {level, message, timestamp: new Date().toISOString()}}, true)
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

  // this doesn't provide enough resolution
  block.start = new Date().toISOString()

  const start = performance.now()

  if (block.enabled === false) {
    // handle skip
    block.state = RunState.Skipped
    event?.(BlockEvent.Skipped, {block})
    event?.(BlockEvent.Ended, {block})
    return block
  }

  event?.(BlockEvent.Started, {block})

  // TODO: implement waiting/delay
  if (block.options?.delay && block.options.delay !== '0s' && block.options.delay !== 0) {
    //const delayMs = getDurationNumber(block.options.delay as string) || 0
    //event?.(BlockEvent.Waiting, {block, delayMs})
    //await delayFor(delayMs || 0)
  }

  const method = defaultWith('exponential', block.options?.backoff)
  const delayFn = getBackoffStrategy(method as string)
  const options = block.options!

  block.state = RunState.Running

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

      errors.push(a.error)

      event?.(BlockEvent.Retrying, {block, attempt: a})
    },
  })

  const end = performance.now()

  const output = new ResultBuilder(block).withResult(result).withErrors(errors).build()

  output.duration = end - start

  event?.(BlockEvent.Ended, {block: output})

  return output
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

  // this was cached when moving to @xgsd/runtime
  // no more multiple calls into usercode
  block.fn = await importUserModuleRunFn(block, ctx)

  const result = await processBlock({
    block,
    event,
  })

  // removed waiting from here
  // less data is sent between processes
  // so less need to delay

  dispatchMessage('result', {result: {block: result}})
})
