import {RuntimePresetFunction} from '../bootstrap'
import {composePreset, composePresetWithOpts} from '../sdk'

class CoreExecutor {}
class CoreOrchestrator {}
class MyExecutor {}
class MyOrchestrator {}

describe('composePreset(withOpts)()', () => {
  test('passes options into the preset function', () => {
    const presetFunction = jest.fn().mockReturnValue({
      loggers: [],
      plugins: [],
      executor: CoreExecutor,
      orchestrator: CoreOrchestrator,
    })

    composePresetWithOpts({
      presets: [presetFunction],
      opts: {
        option: true,
      },
    })

    expect(presetFunction).toHaveBeenCalledTimes(1)
    expect(presetFunction).toHaveBeenCalledWith({option: true})
  })

  test('executor/orchestrator should be taken from final function', () => {
    const firstPresetFunction = (opts: any) => ({
      loggers: [],
      plugins: [],
      executor: MyExecutor,
      orchestrator: MyOrchestrator,
    })

    const finalPresetFunction = (opts: any) => ({
      loggers: [],
      plugins: [],
      executor: CoreExecutor,
      orchestrator: CoreOrchestrator,
    })

    const preset = composePresetWithOpts({
      presets: [firstPresetFunction as any, finalPresetFunction],
      opts: {},
    })

    expect(preset.executor).toBe(CoreExecutor)
    expect(preset.executor).not.toBe(MyExecutor)

    expect(preset.orchestrator).toBe(CoreOrchestrator)
    expect(preset.orchestrator).not.toBe(MyOrchestrator)
  })

  test('merges logger/plugins correctly', () => {
    class FirstLogger {}
    class SecondLogger {}

    class FirstPlugin {}
    class SecondPlugin {}

    const firstPresetFunction = () => ({
      loggers: [FirstLogger],
      plugins: [FirstPlugin],
      executor: MyExecutor,
      orchestrator: MyOrchestrator,
    })

    const secondPresetFunction = () => ({
      loggers: [SecondLogger],
      plugins: [SecondPlugin],
    })

    const preset = composePresetWithOpts({
      presets: [firstPresetFunction as any, secondPresetFunction as any],
      opts: {},
    })

    // order is preserved
    expect(preset.loggers).toEqual([FirstLogger, SecondLogger])
    expect(preset.plugins).toEqual([FirstPlugin, SecondPlugin])
  })

  test('passing presets functions directly is accepted (not options)', () => {
    const presetFunction1 = jest.fn().mockReturnValue(
      () =>
        ({
          loggers: [],
          plugins: [],
          executor: MyExecutor,
          orchestrator: MyOrchestrator,
        }) as any,
    )

    const presetFunction2 = () =>
      ({
        loggers: [],
        plugins: [],
      }) as any

    const preset = composePreset(presetFunction1, presetFunction2)
    expect(preset).toBeDefined()

    // internally calls composePresetWithOpts
    expect(presetFunction1).toHaveBeenCalledWith({})
  })
})
