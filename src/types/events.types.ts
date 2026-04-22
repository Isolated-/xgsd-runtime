import {RetryAttempt} from '@xgsd/engine'
import {Context} from 'vm'
import {Block} from '../config'
import {ExtensionType} from '../extension/util'
import {LoggerLevel} from './interfaces/logger.interface'

export enum ProjectEvent {
  Started = 'project.started',
  Ended = 'project.ended',
}

export enum BlockEvent {
  Started = 'block.started',
  Ended = 'block.ended',
  Failed = 'block.failed',
  Retrying = 'block.retrying',
  Skipped = 'block.skipped',
  Waiting = 'block.waiting',
  Error = 'block.error',
}

export enum SystemEvent {
  ExtensionLoaded = 'extension.loaded',
  ExtensionUnloaded = 'extension.unloaded',
  SystemMessage = 'system.message',
}

export type Events = {
  [ProjectEvent.Started]: {
    ctx: Context
  }
  [ProjectEvent.Ended]: {
    ctx: Context
  }
  [BlockEvent.Started]: {
    block: Block
  }
  [BlockEvent.Ended]: {
    block: Block
  }
  [BlockEvent.Failed]: {
    block: Block
    error: unknown
    errors?: unknown[]
  }
  [BlockEvent.Retrying]: {
    block: Block
    attempt: RetryAttempt
  }
  [BlockEvent.Waiting]: {
    block: Block
  }
  [SystemEvent.SystemMessage]: {
    level: LoggerLevel
    message: string
    data?: Record<string, unknown>
  }
  [SystemEvent.ExtensionLoaded]: {
    name: string
    core: boolean
    version?: string
    type: ExtensionType
  }
  [SystemEvent.ExtensionUnloaded]: {
    name: string
    core: boolean
    version?: string // future support
    type: ExtensionType
  }
  [key: string]: Record<string, unknown>
}
