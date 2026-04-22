import {createRuntime, resolveFactory} from '../extension/util'
import {Hooks} from '../types/hooks.types'
import {Executor} from '../types/generics/executor.interface'
import {Block, Context} from '../config'

class CorePlugin implements Hooks {}

test('resolveFactory()', () => {
  class MyExecutor implements Executor {
    async run(block: Block<any>, context: Context<any>): Promise<Block<any>> {
      return block
    }
  }

  let result = resolveFactory(MyExecutor)
  expect(result).toEqual(expect.any(Function))

  result = resolveFactory(new MyExecutor())
  expect(result).toEqual(expect.any(Function))

  result = resolveFactory((_: any) => new MyExecutor())
  expect(result).toEqual(expect.any(Function))
})
