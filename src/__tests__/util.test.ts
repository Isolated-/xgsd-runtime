import {
  buildFactories,
  createRuntime,
  importUserModule,
  importUserModuleRunFn,
  loadUserSetup,
  resolveFactory,
  runExit,
  runInit,
} from '../extension/util'
import {Executor} from '../types/generics/executor.interface'
import {Block, Context} from '../config'
import {join} from 'path'
import {FatalError} from '../error'
import {SystemEvent} from '../types/events.types'
import {UserModule} from '../extension/user-module'

/**
 *  resolveFactory()
 */
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

test('resolveFactory() returns metadata', async () => {
  class MyPlugin {}

  const result = resolveFactory(MyPlugin, {type: 'plugin', core: false})
  const loaded = result({} as any)

  expect(loaded.name).toBe('MyPlugin')
  expect(loaded.type).toBe('plugin')
  expect(loaded.core).toBeFalsy()
})

/**
 *  buildFactories()
 */
test('buildFactories() drops undefined', () => {
  const undefFactory = () => {}
  expect(buildFactories([undefFactory], {} as any)).toHaveLength(0)
})

test('buildFactories() removes erroring extensions', () => {
  const errorFactory = () => {
    throw new Error('bad')
  }

  expect(buildFactories([errorFactory], {} as any)).toHaveLength(0)
})

/**
 * loadUserSetup()
 */
test('loadUserSetup() should call setup() in usercode', async () => {
  await loadUserSetup(
    {
      async setup(setup) {
        expect(setup).toBeDefined()
      },
    },
    {
      use: jest.fn(),
    } as any,
  )
})

test('importUserModuleRunFn() should throw error when "run" isnt exported', async () => {
  const entry = join(process.cwd(), 'index.js')

  await expect(
    importUserModuleRunFn(
      {
        run: 'missing',
      } as any,
      {entry} as any,
    ),
  ).rejects.toThrow(FatalError)
})

test('importUserModuleRunFn() should throw error when "run" isnt a function', async () => {
  const entry = join(process.cwd(), 'index.js')

  await expect(
    importUserModuleRunFn(
      {
        run: 'badAction',
      } as any,
      {entry} as any,
    ),
  ).rejects.toThrow(FatalError)
})

/**
 *  runInit()
 */
test('runInit() should call init() on children', async () => {
  const plugin = {
    type: 'plugin',
    init: jest.fn(),
  } as any

  const bus = {
    emit: jest.fn(),
  }

  const ctx = {} as any
  await runInit([plugin], ctx, bus as any)

  expect(plugin.init).toHaveBeenCalledWith(ctx)
  expect(bus.emit).toHaveBeenCalledWith(SystemEvent.ExtensionLoaded, {
    name: expect.any(String),
    core: expect.any(Boolean),
    type: expect.any(String),
  })
})

/**
 *  runExit()
 */
test('runExit() should call exit() on children', async () => {
  const plugin = {
    type: 'plugin',
    exit: jest.fn(),
  } as any

  const bus = {
    emit: jest.fn(),
  }

  const ctx = {} as any
  await runExit([plugin], ctx, bus as any)

  expect(plugin.exit).toHaveBeenCalledWith(ctx)
  expect(bus.emit).toHaveBeenCalledWith(SystemEvent.ExtensionUnloaded, {
    name: expect.any(String),
    core: expect.any(Boolean),
    type: expect.any(String),
  })
})
