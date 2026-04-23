export enum FatalErrorCode {
  NoOrchestrator = 'CODE_NO_ORCHESTRATOR',
  NoExecutor = 'CODE_NO_EXECUTOR',
  HardTimeout = 'CODE_HARD_TIMEOUT',
  HardDataSize = 'CODE_HARD_DATA_SIZE',
  FatalError = 'CODE_FATAL_ERROR',
  ModuleNotFound = 'CODE_MODULE_NOT_FOUND',
  FunctionNotFound = 'CODE_FUNCTION_NOT_FOUND',
}

export class FatalError extends Error {
  code: string
  name: string
  message: string
  stack?: string
  original?: Error

  constructor(message: string, code: FatalErrorCode, original?: Error) {
    super(message)
    this.name = 'FatalError'
    this.message = message
    this.code = code
    this.original = original

    if (original && original.stack) {
      this.stack = original.stack
    } else {
      Error.captureStackTrace(this, this.constructor)
    }
  }
}
