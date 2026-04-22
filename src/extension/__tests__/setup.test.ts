import {Block, Context} from '../../config'
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

test('.build() throws an Error when no executor is provided', () => {
  const setup = new SetupContainer({})

  expect(setup.build({} as any)).rejects.toThrow(
    expect.objectContaining({
      message: expect.stringContaining('an executor has not been configured'),
    }),
  )
})

test('.build() returns executor', async () => {
  const setup = new SetupContainer()
  setup.executor(MockExecutor)
  const {executor} = await setup.build({} as any)
  expect(executor).toBeInstanceOf(MockExecutor)
})

test('.build() returns pluginManager', async () => {
  const setup = new SetupContainer()
  setup.use(MockPlugin)
  setup.executor(MockExecutor)

  const {pluginManager} = await setup.build({} as any)
  expect(pluginManager).toBeInstanceOf(PluginManager)
})

test('.build() returns loggerManager', async () => {
  const setup = new SetupContainer()

  setup.logger(MockLogger)
  setup.executor(MockExecutor)

  const {loggerManager} = await setup.build({} as any)
  expect(loggerManager).toBeInstanceOf(LoggerManager)
})
