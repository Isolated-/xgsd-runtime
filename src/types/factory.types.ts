import {Hooks} from './hooks.types'
import {Executor} from './generics/executor.interface'
import {Logger} from './interfaces/logger.interface'
import {Plugin} from './interfaces/plugin.interface'
import {Context} from '../config'

export type Factory<T> = (ctx: Context) => T
export type FactoryInput<T> = T | Factory<T> | (new (ctx: Context) => T)

export type ExecutorFactory = Factory<Executor>
export type ExecutorInput = FactoryInput<Executor>

export type PluginFactory = Factory<Plugin>
export type PluginInput = FactoryInput<Plugin>

export type LoggerFactory = Factory<Logger>
export type LoggerInput = FactoryInput<Logger>
