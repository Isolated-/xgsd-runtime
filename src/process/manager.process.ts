import {fork} from 'child_process'
import {RunState} from '../types/state.types'
import {FatalError, FatalErrorCode} from '../error'
import {BlockEvent, SystemEvent} from '../types/events.types'
import {LoggerLevel} from '../types/interfaces/logger.interface'
import {Block, Context} from '../config'

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
    this.process = fork(this.path, {
      stdio: ['pipe', 'pipe', 'pipe', 'ipc'],
      env: {
        PROJECT_ID: this.context.id ?? 'none',
        PROJECT_CONFIG_HASH: this.context.hash ?? 'none',
        ...this.block.env,
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
