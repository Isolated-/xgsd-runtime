import {SourceData} from '@xgsd/engine'
import {EventBus} from '../event'
import {Metrics, ProjectConfig} from './config.types'
import {RunState} from './state.types'
import {Runnable} from '../process/orchestration.process'

export type ContextOpts = {
  timeout?: number
  retries?: number
  backoff?: 'exponential' | 'linear' | 'squaring'
}

export type Activation = 'cli' | 'http'

export type Context<T extends SourceData = SourceData> = {
  id: string
  hash: string
  name: string
  version: string
  entry: string
  projectPath: string
  mode: string
  activation: Activation
  concurrency: number
  //options: ContextOpts
  //env: Record<string, any>
  data: SourceData
  output: SourceData // <- actually implemented as an array of Blocks
  blockCount: number
  blocks: Block<T>[]
  state: RunState
  start: string
  end: string | null
  bus: EventBus<any>
  environment: Record<string, any>
  config: ProjectConfig
  metrics?: Metrics
}

export type BlockContext<T extends SourceData = SourceData> = {
  idx: number
  name: string
  enabled: boolean
  run: string
  options?: ContextOpts
  env: Record<string, unknown>
  attempt?: number
  input: T
  output: T
  error: any | null
  state: string
  errors: any[]
  start: string | null
  end: string | null
  duration: number | null
}

export type Block<T extends SourceData = SourceData> = BlockContext<T> & Runnable
