export type Options = {
  retries?: number
  timeout?: string | number
  backoff?: 'linear' | 'exponential' | 'squaring'
}

export type UsageAcceptTypes = 'execution' | 'minimal'

export type Usage = {
  enabled?: boolean
  accept?: UsageAcceptTypes[]
}

export type BlockConfig = {
  name?: string
  description?: string
  run: string
  version?: number
  input?: Record<string, unknown>
  env?: Record<string, unknown>
  options?: Options
  metadata?: Record<string, any>
}

export type ProjectConfig = {
  // metadata
  name?: string
  description?: string
  version?: string
  entry?: string

  // user metadata (unused)
  metadata?: Record<string, any>

  // runtime
  mode?: 'chain' | 'async'
  concurrency?: number
  data?: Record<string, unknown>
  env?: Record<string, unknown>
  options?: Options

  // block config
  blocks?: BlockConfig[]

  // misc
  usage?: Usage

  // keep this flexible - let apps validate
  [key: string]: unknown
}
