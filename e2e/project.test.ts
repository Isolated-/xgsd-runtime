import {bootstrap, ConfigParser, createContext, EventBus, InProcessExecutor, ProjectEvent, RuntimePreset} from '../src'
import EventEmitter2 from 'eventemitter2'
import {pathExistsSync, readFileSync, readJsonSync, rmSync} from 'fs-extra'
import {join} from 'path'

const pkg = join(__dirname, 'fixtures', 'usercode')
const logFile = join(pkg, 'temp.txt')

const createApp = () => {
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
    .data(config.project.data)
    .mode()
    .concurrency(config.project.concurrency)
    .blocks()
    .blockCount()
    .build()

  const preset: RuntimePreset = {
    executor: InProcessExecutor,
  }

  return {ctx, bus, stream, preset}
}

/**
 *  @note
 *  this runs a real project that has been used thousands of times
 *  during development. It runs in chained mode and makes an API request
 *  plus calls filesystem APIs to log temperature data to file.
 *
 *  The setup code is typically managed by @xgsd/cli.
 */
test('successfully runs a real project in chained mode (no process isolation)', async () => {
  if (pathExistsSync(logFile)) {
    rmSync(logFile)
  }

  const {ctx, stream, bus, preset} = createApp()

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
