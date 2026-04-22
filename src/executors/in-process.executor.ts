import {SourceData} from '@xgsd/engine'
import {Block, Context} from '../config'
import {processBlock} from '../process/block.process'
import {Executor} from '../types/generics/executor.interface'
import {Events} from '../types/events.types'

export class InProcessExecutor<T extends SourceData = SourceData> implements Executor<T> {
  async run(block: Block<T>, context: Context<T>): Promise<Block<T>> {
    const event = async <K extends keyof Events>(name: keyof Events, payload: Events[K]) => {
      await context.bus.emit<typeof name>(name, payload)
    }

    return processBlock({
      block,
      event,
    }) as any
  }
}
