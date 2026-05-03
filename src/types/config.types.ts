export type Options = {
  retries?: number
  timeout?: string | number
  backoff?: 'linear' | 'exponential' | 'squaring'
}

export type MetricsAcceptType = 'basic'

export type Metrics = {
  enabled?: boolean
  url?: string
  urls?: string[]
  accept?: MetricsAcceptType[]
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
  metrics?: Metrics

  // keep this flexible - let apps validate
  [key: string]: unknown
}
