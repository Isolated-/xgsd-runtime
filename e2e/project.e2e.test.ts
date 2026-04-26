import {
  BlockEvent,
  bootstrap,
  ConfigParser,
  createContext,
  EventBus,
  InProcessExecutor,
  ProjectEvent,
  RuntimePreset,
  SystemEvent,
} from '../src'
import EventEmitter2 from 'eventemitter2'
import {pathExistsSync, readJsonSync, rmSync} from 'fs-extra'
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

const capture = <T = any>(bus: EventBus<any>, event: string) => {
  return new Promise<T>((resolve) => {
    bus.once(event, ({payload}: any) => {
      resolve(payload)
    })
  })
}

const collect = <T = any>(bus: any, event: string) => {
  const items: T[] = []

  const off = bus.on(event, ({payload}: any) => {
    items.push(payload.attempt ?? payload)
  })

  return {
    items,
    stop: off,
  }
}

function assertCompletedChainContext(event: any) {
  expect(event.context).toBeDefined()
  expect(event.context.mode).toBe('chain')
  expect(event.context.state).toBe('completed')
  expect(event.context.bus).toBeUndefined()

  expect(event.context.start).toEqual(expect.any(String))
  expect(event.context.end).toEqual(expect.any(String))
}

function assertChainOutputShape(output: any[]) {
  expect(output).toHaveLength(3)

  expect(output[0].output).toEqual(
    expect.objectContaining({
      temperature: expect.any(Number),
    }),
  )

  expect(output[1].input).toEqual(
    expect.objectContaining({
      temperature: expect.any(Number),
    }),
  )
}

function assertLondonMessageTemplate(input: any) {
  const regex = /^It's\s\d+(\.\d+)?°C\sin\sLondon!$/

  expect(input.message).toEqual(expect.stringMatching(regex))
  expect(input.message).not.toContain('{{')
}

function assertRetryAttempt(attempt: any, expected: Partial<any>) {
  expect(attempt.attempt).toBe(expected.attempt)
  expect(attempt.finalAttempt).toBe(expected.finalAttempt)
  expect(attempt.error.message).toBe(expected.errorMessage)
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

  const finalEventPromise = capture(bus, ProjectEvent.Ended)

  await bootstrap({
    ctx,
    stream,
    preset,
  })

  const finalEvent = (await finalEventPromise) as any

  assertCompletedChainContext(finalEvent)
  assertChainOutputShape(finalEvent.output)
  assertLondonMessageTemplate(finalEvent.output[1].input)
}, 10000)

test('runs a project that completes with failed blocks (and retries enabled)', async () => {
  const pkg = join(__dirname, 'fixtures', 'usercode_failing_with_retry')

  const {ctx, stream, bus, preset} = createApp(pkg, {
    num: 1,
  })

  const finalEventPromise = capture(bus, ProjectEvent.Ended)
  const retryCollector = collect(bus, BlockEvent.Retrying)

  await bootstrap({
    ctx,
    stream,
    preset,
  })

  retryCollector.stop()

  expect(retryCollector.items).toHaveLength(2)
  const retryEvents = retryCollector.items

  const finalEvent = await finalEventPromise
  const ref = retryEvents.reverse()[0]

  assertRetryAttempt(ref, {attempt: 1, finalAttempt: true, errorMessage: 'something went wrong'})

  expect(finalEvent.output[0].state).toBe('failed')
}, 30000)

test('runs a project that completes with failed blocks (without retries enabled)', async () => {
  const pkg = join(__dirname, 'fixtures', 'usercode_failing_without_retry')

  const {ctx, stream, bus, preset} = createApp(pkg, {
    num: 1,
  })

  const retryEventsCollector = collect(bus, BlockEvent.Retrying)
  const blockFailedPromise = capture(bus, BlockEvent.Failed)

  await bootstrap({
    ctx,
    stream,
    preset,
  })

  retryEventsCollector.stop()

  const blockFailEvent = await blockFailedPromise

  expect(retryEventsCollector.items).toHaveLength(1)
  expect(blockFailEvent!.block.state).toBe('failed')

  assertRetryAttempt(retryEventsCollector.items[0], {
    attempt: 0,
    errorMessage: 'something went wrong',
    finalAttempt: true,
  })

  expect(blockFailEvent.error).toBe(retryEventsCollector.items[0].error)
}, 30000)

test('runs an advanced project setup with custom Executor and Orchestrator', async () => {
  const pkg = join(__dirname, 'fixtures', 'usercode_advanced')

  const {ctx, stream, bus, preset} = createApp(pkg, {
    num: 1,
  })

  // we're mainly just testing that project events are correctly fired
  // block events are managed by the executor
  const startEventPromise = capture(bus, ProjectEvent.Started)
  const finalEventPromise = capture(bus, ProjectEvent.Ended)

  await bootstrap({ctx, stream, preset})

  const startEvent = await startEventPromise
  const finalEvent = await finalEventPromise

  expect(startEvent).toBeDefined()
  expect(finalEvent).toBeDefined()

  expect(startEvent!.context.state).toBe('running')
  expect(finalEvent!.context.state).toBe('completed')
  expect(finalEvent!.output).toHaveLength(1)
})

/**
 *  EVENT FIRING TESTS
 */
const EVENTS_TO_TRACK = [
  SystemEvent.Started,
  SystemEvent.Ended,
  ProjectEvent.Started,
  ProjectEvent.Ended,
  BlockEvent.Started,
  BlockEvent.Ended,
  BlockEvent.Failed,
  BlockEvent.Retrying,
  BlockEvent.Skipped,
  BlockEvent.Waiting,
]

function createCollectors<T extends string>(bus: EventBus<any>, events: T[]) {
  const collectors: Record<T, ReturnType<typeof collect>> = {} as any

  for (const e of events) {
    collectors[e] = collect(bus, e)
  }

  return collectors
}

test('project runs dont emit more events than expected', async () => {
  const pkg = join(__dirname, 'fixtures', 'usercode_failing_with_retry')

  const {ctx, stream, bus, preset} = createApp(pkg, {
    num: 1,
  })

  const collectors = createCollectors<string>(bus, EVENTS_TO_TRACK)

  await bootstrap({ctx, stream, preset})

  const results: Record<string, any[]> = {}
  for (const [name, collector] of Object.entries(collectors)) {
    collector.stop()
    results[name] = collector.items
  }

  expect(results[SystemEvent.Started]).toHaveLength(1)
  expect(results[SystemEvent.Ended]).toHaveLength(1)
  expect(results[ProjectEvent.Started]).toHaveLength(1)
  expect(results[ProjectEvent.Ended]).toHaveLength(1)
  expect(results[BlockEvent.Started]).toHaveLength(1)
  expect(results[BlockEvent.Ended]).toHaveLength(1)
  expect(results[BlockEvent.Retrying]).toHaveLength(2)
  expect(results[BlockEvent.Skipped]).toHaveLength(0)
  expect(results[BlockEvent.Waiting]).toHaveLength(0)
  expect(results[BlockEvent.Failed]).toHaveLength(1)
}, 10000)
