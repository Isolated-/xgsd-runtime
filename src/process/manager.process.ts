import {fork} from 'child_process'
import {RunState} from '../types/state.types'
import {FatalError, FatalErrorCode} from '../error'
import {BlockEvent, SystemEvent} from '../types/events.types'
import {LoggerLevel} from '../types/interfaces/logger.interface'
import {Block, BlockContext, Context, getPackageVersion} from '../config'
import {pathExistsSync, readFileSync, readJsonSync} from 'fs-extra'
import {parse} from 'dotenv'
import * as path from 'path'

export const event = (name: string, payload: object) => {
  process.send!({type: 'PARENT:EVENT', event: name, payload})
}

const log = async (message: string, level: LoggerLevel, context?: Context, block?: Block) => {
  if (context?.bus) {
    await context.bus.emit(SystemEvent.SystemMessage, {
      level,
      message,
      data: {
        block,
      },
    })
    return
  }
}

function resolveEnvVarsFromPath(inputPath: string, ref: string): string {
  const resolvedPath = path.isAbsolute(inputPath) ? inputPath : path.resolve(process.cwd(), inputPath)

  if (!resolvedPath || !pathExistsSync(resolvedPath)) {
    throw new FatalError(`Cannot load ${ref} from ${inputPath} - doesn't exist`, FatalErrorCode.EnvVarLoadFail)
  }

  let json: any = null

  try {
    json = readJsonSync(resolvedPath)
  } catch {}

  if (json !== null) {
    if (!(ref in json)) {
      throw new FatalError(`Missing key "${ref}" in ${inputPath}`, FatalErrorCode.EnvVarLoadFail)
    }

    return String(json[ref])
  }

  const content = readFileSync(resolvedPath, 'utf-8')
  const parsed = parse(content)

  if (!(ref in parsed)) {
    throw new FatalError(`Missing env var "${ref}" in ${inputPath}`, FatalErrorCode.EnvVarLoadFail)
  }

  return parsed[ref].trim()
}

type BlockLike = {
  env: Record<string, unknown> | undefined
}

function resolveEnvVars(block: BlockLike): Record<string, unknown> {
  if (!block.env) return {}

  const env: Record<string, unknown> = {}

  for (const [key, data] of Object.entries(block.env)) {
    if (typeof data === 'object' && data !== null) {
      const {ref, source, path} = data as any

      if (!ref || !source) {
        throw new FatalError(`Invalid env config for "${key}" - missing ref/source`, FatalErrorCode.EnvVarLoadFail)
      }

      let value: string

      if (source === 'file') {
        if (!path) {
          throw new FatalError(`Missing path for key "${key}"`, FatalErrorCode.EnvVarLoadFail)
        }

        value = resolveEnvVarsFromPath(path, ref)
      } else {
        if (!(ref in process.env)) {
          throw new FatalError(`"${ref}" not set in process.env`, FatalErrorCode.EnvVarLoadFail)
        }

        value = String(process.env[ref])
      }

      env[key] = value
      block.env[key] = '*'.repeat(value.length)

      continue
    }

    env[key] = data
  }

  return env
}

export class ProcessManager {
  process: any
  startedAt: number

  constructor(
    public block: Block,
    public context: Context,
    public path: string,
    public timeoutMs?: number,
  ) {
    this.startedAt = Date.now()
  }

  fork() {
    // resolve env vars here vs at load
    // to prevent leaking
    const envVars = resolveEnvVars(this.block)

    this.process = fork(this.path, {
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
      env: {
        XGSD_VERSION: getPackageVersion('@xgsd/runtime'),
        PROJECT_NAME: this.context.name ?? 'not set',
        PROJECT_PATH: this.context.packagePath,
        MODE: this.context.mode,
        CONCURRENCY: String(this.context.concurrency),
        RUN_ID: this.context.id ?? 'none',
        BLOCK_NAME: this.block.name ?? this.block.run,
        BLOCK_INDEX: String(this.block.idx),
        HOME: process.env.HOME,
        ...envVars,
      },
      execArgv: ['--max-old-space-size=256', '--stack-size=1024'],
    })

    this.process.stdout?.on('data', (chunk: Buffer) => {
      const msg = chunk.toString().trim()
      if (msg) log(msg, LoggerLevel.Info, this.context, this.block)
    })

    this.process.stderr?.on('data', (chunk: Buffer) => {
      const msg = chunk.toString().trim()
      if (msg) log(msg, LoggerLevel.Error, this.context, this.block)
    })
  }

  run(prefix: string = 'CHILD'): Promise<{block: any; fatal: boolean; errors: any[]}> {
    return new Promise((resolve) => {
      let timer: NodeJS.Timeout | null = null

      const timerHandler = () => {
        this.process.kill()
        const error = new FatalError('hard timeout limit reached', FatalErrorCode.HardTimeout)
        const updated = {
          ...this.block,
          start: new Date(this.startedAt).toISOString(),
          end: new Date().toISOString(),
          duration: Date.now() - this.startedAt,
          state: RunState.Failed,
          error,
          errors: [error],
        }

        resolve({block: updated, fatal: true, errors: []})
      }

      if (this.timeoutMs) {
        timer = setTimeout(timerHandler, this.timeoutMs)
      }

      this.process.on('message', async (msg: any) => {
        switch (msg.type) {
          case `${prefix}:EVENT`:
            if (msg.event === BlockEvent.Started || msg.event === BlockEvent.Ended) {
              if (timer) clearTimeout(timer)
              timer = setTimeout(timerHandler, this.timeoutMs!) // <- don't add an additional second here
            }

            if (msg.event === BlockEvent.Retrying) {
              if (timer) clearTimeout(timer)
              timer = setTimeout(timerHandler, this.timeoutMs! + msg.payload.attempt.nextMs + 500)
            }

            // v0.5 or later
            await this.context.bus.emit(msg.event, {
              event: msg.event,
              payload: msg.payload,
            })
            break

          case `${prefix}:LOG`:
            if (timer) clearTimeout(timer)
            timer = setTimeout(timerHandler, this.timeoutMs! + 1000)
            log(msg.log.message, msg.log.level, this.context, this.block)
            break

          case `${prefix}:RESULT`:
            this.process.kill()
            if (timer) clearTimeout(timer)
            resolve({block: msg.result.block, fatal: false, errors: msg.result.block.errors})
            break

          case `${prefix}:ERROR`:
            this.process.kill()
            if (timer) clearTimeout(timer)
            resolve({
              block: {...this.block, state: RunState.Failed},
              fatal: true,
              errors: [msg.error],
            })
            break
        }
      })

      // send start command
      this.process.send({
        type: 'START',
        block: this.block,
        ctx: {entry: this.context.entry, packagePath: this.context.packagePath, blockCount: this.context.blockCount},
      })
    })
  }
}
