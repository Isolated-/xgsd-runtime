import {ProcessManager} from '../process/manager.process'
import {Executor} from '../types/generics/executor.interface'
import {deepmerge2} from '../util/object.util'
import {Block, Context} from '../config'
import {SourceData} from '@xgsd/engine'
import ms from 'ms'

export class ProcessExecutor<T extends SourceData = SourceData> implements Executor<T> {
  async run(block: Block, context: Context): Promise<Block<T>> {
    const result = await this.runIsolated(block, context)
    return result.block
  }

  private async runIsolated(block: Block, context: Context) {
    let timeoutMs: number | undefined
    // TODO: update this so project options aren't used
    const opts = block.options

    if (opts?.timeout) {
      timeoutMs = typeof opts.timeout === 'string' ? ms(opts.timeout as ms.StringValue) : opts.timeout
    }

    const path = require.resolve('@xgsd/runtime/process/block.process')
    const manager = new ProcessManager(block, context, path, timeoutMs)

    manager.fork()

    process.on('exit', () => {
      manager.process.kill()
    })

    return manager.run()
  }
}
