import {Context} from '../config'

export interface Hooks {
  name?: string
  events?: string[]

  // new event handler
  // generic to avoid need to add more events
  // like projectWait
  on?<T = unknown>(event: string, payload: T): Promise<void> | void

  // this may not be on external plugins
  emit?<T = unknown>(event: string, payload: T): Promise<void> | void

  // init()
  // called when extension is first loaded
  init?(context: Context): Promise<void> | void

  // exit()
  // called when extension is unloaded
  exit?(context: Context): Promise<void> | void
}
