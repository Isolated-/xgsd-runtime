import {ProcessManager} from '../process/manager.process'
import {Block, Context} from '../types/context.types'
import {Executor} from '../types/generics/executor.interface'
import {SourceData} from '@xgsd/engine'
import ms from 'ms'

export class ProcessExecutor<T extends SourceData = SourceData> implements Executor<T> {
  async run(block: Block, context: Context): Promise<Block<T>> {
    const result = await this.runIsolated(block, context)
    return result.block
  }

  private async runIsolated(block: Block, context: Context) {
    let timeoutMs: number | undefined
    const opts = block.options

    if (opts?.timeout) {
      timeoutMs = typeof opts.timeout === 'string' ? ms(opts.timeout as ms.StringValue) : opts.timeout
    }

    const path = require.resolve('@xgsd/runtime/process/block.process')
    const manager = new ProcessManager(block, context, path, timeoutMs)

    manager.fork()

    return manager.run()
  }
}
