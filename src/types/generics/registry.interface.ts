import {Context} from '../../config'
import {FactoryInput} from '../factory.types'

export interface Registry<T, R, C = Context> {
  use(input: FactoryInput<T>): void
  build(ctx: C): R
}
