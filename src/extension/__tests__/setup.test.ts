import {SourceData} from '@xgsd/engine'
import {Block, Context} from '../../config'
import {Executor} from '../../types/generics/executor.interface'
import {Orchestrator} from '../../types/generics/orchestrator.interface'
import {Logger, LogMessage} from '../../types/interfaces/logger.interface'
import {Plugin} from '../../types/interfaces/plugin.interface'
import {LoggerManager} from '../loggers/logger.manager'
import {PluginManager} from '../plugins/plugin.manager'
import {SetupContainer} from '../setup'

class MockPlugin implements Plugin {}
class MockLogger implements Logger {
  log(event: string, payload: any): Promise<void> | void {
    throw new Error('Method not implemented.')
  }
}

class MockExecutor implements Executor {
  run(block: Block<any>, context: Context<any>): Promise<Block<any>> {
    throw new Error('Method not implemented.')
  }
}

export class MockOrchestrator implements Orchestrator {
  async orchestrate(data: SourceData, blocks: Block[]): Promise<Block[]> {
    throw new Error('method not implemented')
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

test('.orchestrator() should accept MockOrchestrator', () => {
  const setup = new SetupContainer({})
  expect(() => setup.orchestrator(MockOrchestrator)).not.toThrow()
})

test('.build() throws an Error when no executor is provided', () => {
  const setup = new SetupContainer({})
  setup.orchestrator(MockOrchestrator)

  expect(setup.build({} as any)).rejects.toThrow(
    expect.objectContaining({
      message: expect.stringContaining('an executor has not been configured'),
    }),
  )
})

test('.build() throws an Error when no orchestrator is provided', () => {
  const setup = new SetupContainer({})
  setup.executor(MockExecutor)

  expect(setup.build({} as any)).rejects.toThrow(
    expect.objectContaining({
      message: expect.stringContaining('an orchestrator has not been configured'),
    }),
  )
})

test('.build() returns executor', async () => {
  const setup = new SetupContainer()
  setup.executor(MockExecutor)
  setup.orchestrator(MockOrchestrator)

  const {executor} = await setup.build({} as any)
  expect(executor).toBeInstanceOf(MockExecutor)
})

test('.build() returns pluginManager', async () => {
  const setup = new SetupContainer()
  setup.use(MockPlugin)
  setup.executor(MockExecutor)
  setup.orchestrator(MockOrchestrator)

  const {pluginManager} = await setup.build({} as any)
  expect(pluginManager).toBeInstanceOf(PluginManager)
})

test('.build() returns loggerManager', async () => {
  const setup = new SetupContainer()

  setup.logger(MockLogger)
  setup.executor(MockExecutor)
  setup.orchestrator(MockOrchestrator)

  const {loggerManager} = await setup.build({} as any)
  expect(loggerManager).toBeInstanceOf(LoggerManager)
})

test('.build() returns orchestrator', async () => {
  const setup = new SetupContainer()

  setup.executor(MockExecutor)
  setup.orchestrator(MockOrchestrator)

  const {orchestrator} = await setup.build({} as any)
  expect(orchestrator).toBeInstanceOf(MockOrchestrator)
})
