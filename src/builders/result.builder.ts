import {WrappedError, SourceData} from '@xgsd/engine'
import {Block} from '../types/context.types'
import {RunState} from '../types/state.types'

export class ResultBuilder {
  private result: any
  private errors: WrappedError[] = []

  constructor(private block: Block) {}

  withResult(result: {data: any; error: any}): this {
    this.result = result
    return this
  }

  withErrors(errors: WrappedError[]) {
    this.errors = errors
    return this
  }

  build() {
    if (!this.result) {
      throw new Error('result has not been provided')
    }

    const {block, result} = this

    block.output = (result.data as SourceData) ?? {}
    block.error = result.error ?? this.errors[0] ?? null
    //    block.options = {retries, timeout}

    block.errors = this.errors

    // don't assign this to errors length anymore
    // as errors may be deduped
    block.attempt = block.attempt ?? 0

    block.state = result.error ? RunState.Failed : RunState.Completed
    block.end = new Date().toISOString()

    return block
  }
}
