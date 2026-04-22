import {Context} from '../../config'
import {FactoryInput, LoggerFactory, LoggerInput} from '../../types/factory.types'
import {Registry} from '../../types/generics/registry.interface'
import {Logger} from '../../types/interfaces/logger.interface'
import {buildFactories, resolveFactory} from '../util'

export class LoggerRegistry implements Registry<LoggerInput, Logger[], Context> {
  private factories: LoggerFactory[] = []

  use(input: FactoryInput<LoggerInput>, core?: boolean): void {
    this.factories.push(resolveFactory(input, {type: 'logger', core}))
  }

  build(ctx: Context): Logger[] {
    return buildFactories(this.factories, ctx)
  }
}
