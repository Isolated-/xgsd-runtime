import {SourceData} from '@xgsd/engine'
import {getPackageVersion} from '../config'
import {EventBus} from '../event'
import {ProjectConfig} from '../types/config.types'
import {Context, ContextOpts} from '../types/context.types'
import {createBlockContext} from './block-context.builder'
import {createHash} from 'crypto'

export function normaliseContext(ctx: Context): Partial<Context> {
  return {
    id: ctx.id,
    name: ctx.name,
    version: ctx.version,
    hash: ctx.hash,
    entry: ctx.entry,
    activation: ctx.activation,
    projectPath: ctx.projectPath,
    environment: ctx.environment,
    mode: ctx.mode,
    concurrency: ctx.concurrency,
    state: ctx.state,
    data: ctx.data,
    output: ctx.output ?? null,
    blockCount: ctx.blockCount,
    blocks: ctx.blocks,
    start: ctx.start,
    end: ctx.end,
  }
}

// resolve project() (user project path)
export class ContextSetupStage {
  project(path: string) {
    return new ContextEntryStage({
      projectPath: path,
    })
  }
}

export class ContextEntryStage<T extends SourceData> {
  constructor(private ctx: Partial<Context<T>> = {}) {}

  entry(entry: string): ContextConfigStage<T> {
    this.ctx.entry = entry
    return new ContextConfigStage(this.ctx)
  }
}

export class ContextConfigStage<T extends Record<string, unknown>> {
  constructor(private ctx: Partial<Context<T>>) {}

  config(config: ProjectConfig): ContextBusStage<T> {
    return new ContextBusStage({
      ...this.ctx,
      config,
    })
  }
}

export class ContextBusStage<T extends Record<string, unknown>> {
  constructor(private ctx: Partial<Context<T>>) {}

  bus(bus: EventBus<any>): ContextFinalStage<T> {
    return new ContextFinalStage({
      ...this.ctx,
      bus,
    })
  }
}

export class ContextFinalStage<T extends Record<string, unknown>> {
  constructor(private ctx: Partial<Context<T>>) {}

  id(generator: () => string): this {
    this.ctx.id = generator()
    return this
  }

  hash(generator?: (data: Buffer) => string): this {
    const data = Buffer.from(JSON.stringify(this.ctx.config))
    this.ctx.hash = generator?.(data) ?? createHash('sha256').update(data).digest('hex').slice(0, 8)
    return this
  }

  version(version?: string): this {
    const v = version ?? (this.ctx.config?.version as string) ?? getPackageVersion(this.ctx.projectPath!)
    this.ctx.version = v
    return this
  }

  name(name?: string): this {
    const n = name ?? (this.ctx.config?.name as string) ?? 'unknown'
    this.ctx.name = n
    return this
  }

  // TODO: stop merging data inside this method
  // instead just assign it to ctx.input
  // and allow data to be processed before ContextBuilder
  data(data?: SourceData): this {
    this.ctx.data = data ?? {}
    return this
  }

  activation(activation: 'manual' | 'http'): this {
    this.ctx.activation = activation
    return this
  }

  blocks(): this {
    // already done
    if (this.ctx.blocks) {
      return this
    }

    const blocks = this.ctx.config?.blocks
    this.ctx.blocks = blocks?.map((block, idx) => {
      return createBlockContext(block as any, idx) as any
    })

    return this
  }

  env(): this {
    this.ctx.environment = {
      node: process.version,
      runtime: getPackageVersion('@xgsd/runtime'),
      platform: process.platform,
    }

    return this
  }

  concurrency(count?: number): this {
    const mode = this.ctx.mode ?? (this.ctx.config?.mode as string)

    if (mode === 'async') {
      this.ctx.concurrency = count && count > 0 ? count : 4
      return this
    }

    this.ctx.concurrency = 1
    return this
  }

  mode(): this {
    this.ctx.mode = this.ctx.config?.mode as string
    return this
  }

  // not strictly needed
  // is used to prevent needing the array of blocks
  // or full context in child processes (see ContextLike)
  blockCount(): this {
    this.ctx.blockCount = this.ctx.blocks?.length
    return this
  }

  build(): Context<T> {
    return this.ctx as Context<T>
  }
}
