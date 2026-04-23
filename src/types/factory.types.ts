import {Executor} from './generics/executor.interface'
import {Logger} from './interfaces/logger.interface'
import {Plugin} from './interfaces/plugin.interface'
import {Context} from '../config'
import {Orchestrator} from './generics/orchestrator.interface'

export type Factory<T> = (ctx: Context) => T
export type FactoryInput<T> = T | Factory<T> | (new (ctx: Context) => T)

export type ExecutorFactory = Factory<Executor>
export type ExecutorInput = FactoryInput<Executor>

export type OrchestratorFactory = (ctx: Context, executor: Executor) => Orchestrator

export type OrchestratorInput =
  | Orchestrator
  | OrchestratorFactory
  | (new (ctx: Context, executor: Executor) => Orchestrator)

export type PluginFactory = Factory<Plugin>
export type PluginInput = FactoryInput<Plugin>

export type LoggerFactory = Factory<Logger>
export type LoggerInput = FactoryInput<Logger>
