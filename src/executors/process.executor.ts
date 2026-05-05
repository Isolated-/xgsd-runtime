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
    let timeoutMs: number | undefined = 1000
    const opts = block.options

    if (opts?.timeout) {
      timeoutMs = typeof opts.timeout === 'string' ? ms(opts.timeout as ms.StringValue) : opts.timeout
    }

    // blocks that timeout but can still recover
    // shouldn't exit on first try
    // this should fix that
    const retries = opts?.retries ?? 0
    const timeout = timeoutMs * retries + 100

    const path = require.resolve('@xgsd/runtime/process/block.process')
    const manager = new ProcessManager(block, context, path, timeout)

    manager.fork()

    return manager.run()
  }
}
