import {Executor} from './generics/executor.interface'
import {Plugin} from './interfaces/plugin.interface'
import {Orchestrator} from './generics/orchestrator.interface'
import {Context} from './context.types'

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
