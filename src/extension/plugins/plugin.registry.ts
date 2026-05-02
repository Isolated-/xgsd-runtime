import {PluginFactory, PluginInput} from '../../types/factory.types'
import {Hooks} from '../../types/hooks.types'
import {Registry} from '../../types/generics/registry.interface'
import {buildFactories, resolveFactory} from '../util'
import {Context} from '../../types/context.types'

export class PluginRegistry implements Registry<PluginInput, Hooks[], Context> {
  private factories: PluginFactory[] = []

  use(input: PluginInput, core?: boolean) {
    this.factories.push(resolveFactory(input, {type: 'plugin', core}))
  }

  build(ctx: Context): Hooks[] {
    return buildFactories(this.factories, ctx) as Hooks[]
  }
}
