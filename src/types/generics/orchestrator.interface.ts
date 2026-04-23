import {SourceData} from '@xgsd/engine'
import {BlockContext} from '../../config'

export interface Orchestrator<T extends BlockContext = BlockContext> {
  orchestrate(data: SourceData, blocks: T[]): Promise<T[]>
}
