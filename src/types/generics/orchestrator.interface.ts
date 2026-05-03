import {SourceData} from '@xgsd/engine'
import {BlockContext, Context} from '../context.types'

export interface Orchestrator<T extends BlockContext = BlockContext> {
  orchestrate(data: SourceData, blocks: T[]): Promise<Context>
}
