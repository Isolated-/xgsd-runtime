import {SetupContainer} from './setup'

export type UserModule = {
  setup?: (setup: SetupContainer) => Promise<void>
}
