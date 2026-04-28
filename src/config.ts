import * as fs from 'fs-extra'
import * as path from 'path'
import {join} from 'path'
import * as yaml from 'yaml'
import {deepmerge2} from './util/object.util'
import {createHash} from 'crypto'
import {SourceData, WrappedError} from '@xgsd/engine'
import {EventBus} from './event'
import {ExecutionMode, Runnable} from './process/orchestration.process'
import {RunState} from './types/state.types'
import ms from 'ms'

// TODO: extract most of this into @xgsd/runtime as staged builders
// TODO: add result builder for finalising outputs vs hardcoding them in processBlock()

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

export function getPackageVersion(input: string): string {
  try {
    const pkgPath = resolvePackageJson(input)
    const json = fs.readJsonSync(pkgPath)

    if (!json?.version || typeof json.version !== 'string') {
      return 'unknown'
    }

    return `${json.version}`
  } catch (err: any) {
    return 'unknown'
  }
}

function resolvePackageJson(input: string): string {
  try {
    return require.resolve(`${input}/package.json`, {
      paths: [process.cwd()],
    })
  } catch {
    try {
      const entry = require.resolve(input, {
        paths: [process.cwd()],
      })

      let dir = path.dirname(entry)

      while (dir !== path.dirname(dir)) {
        const candidate = path.join(dir, 'package.json')
        if (fs.pathExistsSync(candidate)) return candidate
        dir = path.dirname(dir)
      }

      throw new Error(`package.json not found for ${input}`)
    } catch (err: any) {
      throw new Error(`Cannot resolve package.json for "${input}"`)
    }
  }
}

export type Context<T extends SourceData = SourceData> = {
  id: string
  hash: string
  name: string
  version: string
  entry: string
  packagePath: string
  mode: string
  concurrency: number
  lite: boolean
  data: SourceData
  output: SourceData // <- actually implemented as an array of Blocks
  blockCount: number
  blocks: T[]
  state: RunState
  start: string
  end: string | null
  outputPath: string
  bus: EventBus<any>
  environment: Record<string, any>
  config: {project: T; blocks: T[]}
}

export type Builder<T> = {
  build(): Promise<T> | T
}

// resolve project() (user project path)
export class ContextSetupStage {
  project(path: string) {
    return new ContextEntryStage({
      packagePath: path,
    })
  }
}

export const createContext = (path: string) => {
  return new ContextSetupStage().project(path)
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

  config(config: {project: T; blocks: T[]}): ContextBusStage<T> {
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
    const v = version ?? (this.ctx.config?.project?.version as string) ?? getPackageVersion(this.ctx.packagePath!)
    this.ctx.version = v
    return this
  }

  name(name?: string): this {
    const n = name ?? (this.ctx.config?.project?.name as string) ?? 'unknown'
    this.ctx.name = n
    return this
  }

  output(path?: string): this {
    this.ctx.outputPath = path ?? join(this.ctx.packagePath!, 'runs')
    return this
  }

  // TODO: stop merging data inside this method
  // instead just assign it to ctx.input
  // and allow data to be processed before ContextBuilder
  data(data?: SourceData): this {
    this.ctx.data = data ?? {}
    return this
  }

  lite(lite?: boolean) {
    this.ctx.lite = !!lite
    return this
  }

  blocks(): this {
    // already done
    if (this.ctx.blocks) {
      return this
    }

    const blocks = this.ctx.config?.blocks
    this.ctx.blocks = blocks?.map((block, idx) => {
      return createBlockContext(block, idx) as any
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
    const mode = this.ctx.mode ?? (this.ctx.config?.project.mode as string)

    if (mode === 'async') {
      this.ctx.concurrency = count && count > 0 ? count : 4
      return this
    }

    this.ctx.concurrency = 1
    return this
  }

  mode(): this {
    this.ctx.mode = this.ctx.config?.project.mode as string
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

type BlockConfig<T extends ConfigType = ConfigType> = {}
type BlockOpts = {
  timeout: number | string
  retries: number
  [key: string]: unknown
}

export type BlockContext<T extends SourceData = SourceData> = {
  idx: number
  name: string
  enabled: boolean
  run: string
  options?: BlockOpts
  env: Record<string, unknown>
  attempt?: number
  input: T
  output: T
  error: any | null
  state: string
  errors: any[]
  start: string | null
  end: string | null
  duration: number | null
}

export type Block<T extends SourceData = SourceData> = BlockContext<T> & Runnable

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

  options(options?: BlockOpts): this {
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

export type ConfigType = Record<string, unknown>

type ProjectConfig<T extends ConfigType = ConfigType> = {
  data: T
  blocks?: T[]
}

export type ParseError = {
  stage: 'load' | 'parse' | 'validate'
  message: string
  details?: unknown
}

type UserConfig = {
  name?: string
  description?: string
  version?: string

  mode?: ExecutionMode
  concurrency?: number
  lite?: boolean

  metadata?: Record<string, unknown>

  blocks?: UserBlockConfig[]
}

type UserBlockEnvConfig = {
  type: 'env'
  ref: string
}

type EnvType = Record<string, UserBlockEnvConfig | string | number | boolean | unknown>

type UserBlockConfig = {
  run?: string
  data?: SourceData
  options?: {
    retries?: string | number
    timeout?: string | number
  }
  env?: EnvType
}

export const createConfig = (input: string | ConfigType) => {
  return new ConfigBuilderLoadStage(input).load()
}

export class ConfigBuilderLoadStage {
  constructor(private readonly input: string | ConfigType) {}

  load() {
    if (typeof this.input === 'object') {
      return new ConfigBuilderParseStage(this.input)
    }

    const filePath = this.input

    if (!fs.existsSync(filePath)) {
      throw new Error(`Config file not found: ${filePath}`)
    }

    const content = fs.readFileSync(filePath, 'utf-8')
    return new ConfigBuilderParseStage(content)
  }
}

export class ConfigBuilderParseStage {
  constructor(private readonly _raw: string | Record<string, unknown>) {}

  parse() {
    let parsed: any
    if (typeof this._raw === 'object') {
      parsed = this._raw
      return new ConfigBuilderValidateStage(parsed)
    }

    const raw = String(this._raw).trim()

    // try JSON first
    try {
      parsed = JSON.parse(raw)
      return new ConfigBuilderValidateStage(parsed)
    } catch {}

    // fallback YAML
    parsed = yaml.parse(raw)
    return new ConfigBuilderValidateStage(parsed)
  }
}

export class ConfigBuilderValidateStage {
  constructor(private readonly _config: Partial<UserConfig>) {}
}

export class ConfigBuilderFinalStage {
  build() {}
}

export class ConfigParser<T extends UserConfig = UserConfig> {
  private _errors: ParseError[] = []
  private _raw: unknown
  private _parsed: any
  private _config?: T

  constructor(public input: string | object) {}

  get errors() {
    return this._errors
  }

  // -------------------------
  // LOAD
  // -------------------------
  load(): this {
    try {
      if (typeof this.input === 'object') {
        this._raw = this.input
        return this
      }

      const filePath = path.resolve(this.input)

      if (!fs.existsSync(filePath)) {
        throw new Error(`Config file not found: ${filePath}`)
      }

      const content = fs.readFileSync(filePath, 'utf-8')
      this._raw = content

      return this
    } catch (err: any) {
      this._errors.push({
        stage: 'load',
        message: err.message,
        details: err,
      })
      return this
    }
  }

  // -------------------------
  // PARSE
  // -------------------------
  parse(): this {
    try {
      if (!this._raw) return this

      // already object
      if (typeof this._raw === 'object') {
        this._parsed = this._raw
        return this
      }

      const raw = String(this._raw).trim()

      // try JSON first
      try {
        this._parsed = JSON.parse(raw)
        return this
      } catch {}

      // fallback YAML
      this._parsed = yaml.parse(raw)

      return this
    } catch (err: any) {
      this._errors.push({
        stage: 'parse',
        message: err.message,
        details: err,
      })
      return this
    }
  }

  // -------------------------
  // DEFAULTS
  // -------------------------
  default(defaults: Partial<T> = {} as any): this {
    this._parsed = deepmerge2(defaults, this._parsed ?? {})
    return this
  }

  // -------------------------
  // VALIDATION (placeholder hook)
  // -------------------------
  validate(validator?: (input: any) => T): this {
    try {
      if (validator) {
        this._config = validator(this._parsed)
      } else {
        this._config = this._parsed
      }

      return this
    } catch (err: any) {
      this._errors.push({
        stage: 'validate',
        message: err.message,
        details: err,
      })

      return this
    }
  }

  // -------------------------
  // BUILD
  // -------------------------
  build() {
    if (this._errors.length) {
      throw new Error(this._errors[0].message)
    }

    const snapshot = this._config!
    const {blocks, ...project} = snapshot

    return {
      project,
      blocks,
    }
  }
}
