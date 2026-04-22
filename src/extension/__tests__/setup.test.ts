import {Block, Context} from '../../config'
import {InProcessExecutor} from '../../executors/in-process.executor'
import {ProcessExecutor} from '../../executors/process.executor'
import {Executor} from '../../types/generics/executor.interface'
import {Logger, LogMessage} from '../../types/interfaces/logger.interface'
import {Plugin} from '../../types/interfaces/plugin.interface'
import {LoggerManager} from '../loggers/logger.manager'
import {PluginManager} from '../plugins/plugin.manager'
import {SetupContainer} from '../setup'

class MockPlugin implements Plugin {}
class MockLogger implements Logger {
  log(event: LogMessage<unknown>): Promise<void> | void {
    throw new Error('Method not implemented.')
  }
}
class MockExecutor implements Executor {
  run(block: Block<any>, context: Context<any>): Promise<Block<any>> {
    throw new Error('Method not implemented.')
  }
}

test('.use() should accept plugins correctly', () => {
  const use = jest.fn()
  const setup = new SetupContainer({
    pluginRegistry: {
      use,
    } as any,
  })

  expect(() => setup.use(MockPlugin)).not.toThrow()

  // ensure setup.use() just passes input without mutation
  expect(use).toHaveBeenCalledTimes(1)
  expect(use).toHaveBeenCalledWith(MockPlugin)
})

test('.logger() should accept loggers correctly', () => {
  const use = jest.fn()
  const setup = new SetupContainer({
    loggerRegistry: {
      use,
    } as any,
  })

  expect(() => setup.logger(MockLogger)).not.toThrow()

  // ensure setup.use() just passes input without mutation
  expect(use).toHaveBeenCalledTimes(1)
  expect(use).toHaveBeenCalledWith(MockLogger)
})

test('.executor() should accept executors correctly', () => {
  const setup = new SetupContainer({})

  expect(() => setup.executor(MockExecutor)).not.toThrow()
})

test('.build() should return { pluginManager, loggerManager, executor }', async () => {
  const setup = new SetupContainer()
  const {pluginManager, loggerManager, executor} = await setup.build({
    lite: true, // <- no longer nested
  } as any)

  expect(pluginManager).toBeInstanceOf(PluginManager)
  expect(loggerManager).toBeInstanceOf(LoggerManager)

  expect(executor).toBeInstanceOf(InProcessExecutor)
})

test('.build() returns ProcessExecutor when .lite is false', async () => {
  const setup = new SetupContainer()
  const {executor} = await setup.build({lite: false} as any)
  expect(executor).toBeInstanceOf(ProcessExecutor)
})

test('.build() returns custom/overriden executor', async () => {
  const setup = new SetupContainer()
  setup.executor(MockExecutor)
  const {executor} = await setup.build({lite: false} as any)
  expect(executor).toBeInstanceOf(MockExecutor)
})
