import {RetryAttempt} from '@xgsd/engine'
import {
  BlockEvent,
  bootstrap,
  ConfigParser,
  createContext,
  EventBus,
  InProcessExecutor,
  ProjectEvent,
  RuntimePreset,
} from '../src'
import EventEmitter2 from 'eventemitter2'
import {pathExistsSync, readFileSync, readJsonSync, rmSync} from 'fs-extra'
import {join} from 'path'
import {DefaultOrchestrator} from '../src/orchestrators/default.orchestrator'

const createApp = (pkg: string, data?: any) => {
  const path = join(pkg, 'config.yaml')
  const stream = new EventEmitter2({wildcard: true})
  const bus = new EventBus(stream)

  const config = new ConfigParser(path)
    .load()
    .parse()
    .default({
      mode: 'async',
      concurrency: 4,
      blocks: [],
    })
    .validate((input) => input)
    .build() as {project: any; blocks: any[]} // <- fix this up

  const packageJson = join(pkg, 'package.json')
  const content = readJsonSync(packageJson)

  if (!content.main) {
    throw new Error('no entry point found in package.json')
  }

  const entry = join(pkg, content.main)
  const ctx = createContext(pkg)
    .entry(entry)
    .config(config)
    .bus(bus)
    .id(() => 'id')
    .name()
    .version()
    .data(data ?? config.project.data)
    .mode()
    .concurrency(config.project.concurrency)
    .blocks()
    .blockCount()
    .build()

  const preset: RuntimePreset = {
    executor: InProcessExecutor,
    orchestrator: DefaultOrchestrator,
  }

  return {ctx, bus, stream, preset}
}

/**
 *  @note
 *  this runs a real project that has been used thousands of times during development
 *  during development. It runs in chained mode and makes an API request
 *  plus calls filesystem APIs to log temperature data to file.
 *
 *  The setup code is typically managed by @xgsd/cli.
 */
test('successfully runs a real project in chained mode (no process isolation)', async () => {
  const pkg = join(__dirname, 'fixtures', 'usercode')
  const logFile = join(pkg, 'temp.txt')

  if (pathExistsSync(logFile)) {
    rmSync(logFile)
  }

  const {ctx, stream, bus, preset} = createApp(pkg)

  let finalEvent: any
  bus.on<ProjectEvent.Ended>(ProjectEvent.Ended, ({event, payload}) => {
    finalEvent = payload
  })

  await bootstrap({
    ctx,
    stream,
    preset,
  })

  const result = readFileSync(logFile).toString().trim()
  expect(result).toMatch(/^-?\d+(\.\d+)?°C in .+ \(.+\).*$/)

  // context assertions
  expect(finalEvent.context).toBeDefined()
  expect(finalEvent.context.mode).toBe('chain')
  expect(finalEvent.context.concurrency).toEqual(1)
  expect(finalEvent.context.state).toBe('completed')
  expect(finalEvent.context.end).toEqual(expect.any(String))

  // output assertions
  expect(finalEvent.output).toBeDefined()
  expect(finalEvent.output).toHaveLength(2)

  const validator = expect.objectContaining({temperature: expect.any(Number)})

  // correct data processing in chain mode
  expect(finalEvent.output[0].output).toEqual(validator)
  expect(finalEvent.output[1].input).toEqual(validator)

  // no errors
  expect(finalEvent.output[0].error).toBeNull()
  expect(finalEvent.output[1].error).toBeNull()

  rmSync(logFile)
})

test('runs a project that completes with failed blocks (and retries enabled)', async () => {
  const pkg = join(__dirname, 'fixtures', 'usercode_failing_with_retry')

  const {ctx, stream, bus, preset} = createApp(pkg, {
    num: 1,
  })

  let retryEvents: RetryAttempt[] = []
  let finalEvent: any
  bus.on<ProjectEvent.Ended>(ProjectEvent.Ended, ({event, payload}) => {
    finalEvent = payload
  })

  bus.on<BlockEvent.Retrying>(BlockEvent.Retrying, ({event, payload}) => {
    retryEvents.push(payload.attempt)
  })

  await bootstrap({
    ctx,
    stream,
    preset,
  })

  expect(retryEvents).toHaveLength(2)
  const ref = retryEvents.reverse()[0]

  // even when all blocks fail, the state is still completed
  expect(finalEvent.context.state).toBe('completed')

  expect(ref.attempt).toEqual(1)
  expect(ref.error).toEqual(
    expect.objectContaining({
      message: 'something went wrong',
    }),
  )

  expect(ref.finalAttempt).toBeTruthy()
  expect(ref.maxRetries).toEqual(2)
  expect(ref.nextMs).toEqual(2000)

  expect(finalEvent.output[0].state).toBe('failed')
}, 30000)

test('runs a project that completes with failed blocks (without retries enabled)', async () => {
  const pkg = join(__dirname, 'fixtures', 'usercode_failing_without_retry')

  const {ctx, stream, bus, preset} = createApp(pkg, {
    num: 1,
  })

  let retryEvent: RetryAttempt
  let finalEvent: any
  let failEvent: any
  bus.on<ProjectEvent.Ended>(ProjectEvent.Ended, ({event, payload}) => {
    finalEvent = payload
  })

  bus.on<BlockEvent.Retrying>(BlockEvent.Retrying, ({event, payload}) => {
    retryEvent = payload.attempt
  })

  bus.on<BlockEvent.Failed>(BlockEvent.Failed, ({event, payload}) => {
    failEvent = payload
  })

  await bootstrap({
    ctx,
    stream,
    preset,
  })

  expect(retryEvent!.attempt).toEqual(0)
  expect(retryEvent!.error).toEqual(
    expect.objectContaining({
      message: 'something went wrong',
    }),
  )

  expect(retryEvent!.finalAttempt).toBeTruthy()
  expect(retryEvent!.maxRetries).toEqual(1)

  expect(finalEvent.output[0].state).toBe('failed')
  expect(failEvent.error).toEqual(finalEvent.output[0].error)
}, 30000)

test('runs an advanced project setup with custom Executor and Orchestrator', async () => {
  const pkg = join(__dirname, 'fixtures', 'usercode_advanced')

  const {ctx, stream, bus, preset} = createApp(pkg, {
    num: 1,
  })

  let startEvent
  let finalEvent

  // we're mainly just testing that project events are correctly fired
  // block events are managed by the executor
  bus.on('project.started', ({event, payload}) => {
    startEvent = payload
  })

  bus.on('project.ended', ({event, payload}) => {
    finalEvent = payload
  })

  await bootstrap({ctx, stream, preset})

  expect(startEvent).toBeDefined()
  expect(finalEvent).toBeDefined()

  expect(startEvent!.context.state).toBe('running')
  expect(finalEvent!.context.state).toBe('completed')
})
