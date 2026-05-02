import {SourceData} from '@xgsd/engine'
import ms from 'ms'
import {Block, BlockContext, ContextOpts} from '../types/context.types'
import {RunState} from '../types/state.types'

export const createBlockContext = (block: Partial<Block>, idx: number): BlockContext<SourceData> => {
  return new BlockContextBuilderRunStage()
    .run(block.run!)
    .input(block.input ?? {})
    .disable(block.enabled === false)
    .index(idx)
    .env(block.env ?? {})
    .state(RunState.Pending)
    .name(block.name)
    .options(block.options)
    .build()
}

export class BlockContextBuilderRunStage {
  run(fnName: string) {
    return new BlockContextBuilderInputStage({
      run: fnName,
    })
  }
}

export class BlockContextBuilderInputStage {
  constructor(private ctx: Partial<BlockContext>) {}

  input(input: Record<string, unknown>) {
    return new BlockContextBuilderDisabledStage({
      ...this.ctx,
      input,
    })
  }
}

export class BlockContextBuilderDisabledStage {
  constructor(private ctx: Partial<BlockContext>) {}

  disable(disabled?: boolean) {
    return new BlockContextBuilderFinalStage({
      ...this.ctx,
      enabled: !disabled,
    })
  }
}

export class BlockContextBuilderFinalStage {
  constructor(private ctx: Partial<BlockContext>) {}

  name(name?: string): this {
    this.ctx.name = name ?? this.ctx.run
    return this
  }

  env(env: Record<string, unknown>): this {
    this.ctx.env = env

    return this
  }

  index(idx: number): this {
    this.ctx.idx = idx
    return this
  }

  options(options?: ContextOpts): this {
    const opts = {
      timeout: options?.timeout ?? 5000,
      retries: options?.retries ?? 5,
    }

    if (typeof opts.timeout === 'string') {
      opts.timeout = ms(opts.timeout as ms.StringValue) as number
    }

    this.ctx.options = opts
    return this
  }

  error(error: Record<string, unknown>): this {
    this.ctx.error = error
    return this
  }

  errors(errors: Record<string, unknown>[]): this {
    this.ctx.errors = errors
    return this
  }

  state(state?: RunState): this {
    this.ctx.state = state ?? RunState.Pending
    return this
  }

  build(): BlockContext {
    return this.ctx as BlockContext
  }
}
