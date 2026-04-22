import {Context} from '../../config'

export interface Manager {
  init(ctx: Context): Promise<void>
  exit(ctx: Context): Promise<void>
  emit<T = unknown>(event: string, payload: T): Promise<void>
}
