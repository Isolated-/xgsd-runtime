import {ExecutionMode} from '../process/orchestration.process'
import {PluginInput, ExecutorInput, OrchestratorInput} from './factory.types'

export type RuntimePreset = {
  // mode/concurrency aren't currently supported
  // but should be to represent the parts of config
  // that the runtime is specifically concerned about
  mode?: ExecutionMode
  concurrency?: number
  plugins?: PluginInput[]
  executor?: ExecutorInput
  orchestrator?: OrchestratorInput
}

export type RuntimePresetFunction = (opts?: Record<string, unknown>) => RuntimePreset
