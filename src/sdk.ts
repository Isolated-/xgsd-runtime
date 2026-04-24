// this will eventually become its own library (@xgsd/sdk)
import {retry as coreRetry, execute as coreExecute, RunFn, SourceData, RetryAttempt, withTimeout} from '@xgsd/engine'
import {getBackoffStrategy} from './backoff'
import {RuntimePreset, RuntimePresetFunction} from './bootstrap'

export type RetryOpts = {
  retries?: number
  timeout?: number
  backoff?: 'linear' | 'exponential' | 'squaring' | 'manual'
}

/**
 *  retry() is usually called for your blocks inside a child process.
 *
 *  Use this method when creating new Plugins, Loggers, or Reporters
 *  to ensure retry logic is built in to your extension.
 *
 *  Note: do not call retry() from within your blocks.
 *  This is unneeded and will lead to unexpected results.
 *
 *  @param run
 *  @param data
 *  @param opts
 *  @param attempt
 *  @returns
 */
export async function retry<T extends SourceData = SourceData>(
  run: RunFn<T>,
  data?: T,
  opts?: RetryOpts,
  attempt?: (a: RetryAttempt) => void,
) {
  return coreRetry<T>(data as T, run, opts?.retries || 1, {
    timeoutWrapper: withTimeout(opts?.timeout ?? 1000),
    backoff: getBackoffStrategy(opts?.backoff || 'exponential'),
    onAttempt: attempt,
  })
}

export type ExecuteOpts = {
  timeout?: number
  transform?: (data: any) => any
}

export async function execute<T extends SourceData = SourceData>(run: RunFn<T>, data?: any, opts?: ExecuteOpts) {
  let wrapper = undefined
  if (opts?.timeout) {
    wrapper = withTimeout(opts.timeout)
  }

  return coreExecute(data, run, wrapper)
}

export function composePreset(...presetFunctions: RuntimePresetFunction[]) {
  return composePresetWithOpts({
    presets: presetFunctions,
    opts: {},
  })
}

export function composePresetWithOpts(args: {
  presets: RuntimePresetFunction[]
  opts: Record<string, unknown>
}): RuntimePreset {
  const {presets, opts} = args
  const compiled: RuntimePreset[] = presets.map((p) => p(opts))

  const reversed = [...compiled].reverse()

  return {
    loggers: compiled.flatMap((p) => p.loggers ?? []),
    plugins: compiled.flatMap((p) => p.plugins ?? []),
    executor: reversed.find((p) => p.executor)?.executor,
    orchestrator: reversed.find((p) => p.orchestrator)?.orchestrator,
  }
}
