import {SourceData, WrappedError} from '@xgsd/engine'
import {BlockEvent, ProjectEvent, SystemEvent} from '../events.types'
import {Hooks} from '../hooks.types'

export enum LoggerLevel {
  Info = 'info',
  Warn = 'warn',
  Error = 'error',
}

export type LogMessage<T = unknown> = {
  payload: T
  error?: WrappedError | null
}

export interface Logger<T = unknown> extends Hooks {
  log(event: string, payload: T): Promise<void> | void
}
