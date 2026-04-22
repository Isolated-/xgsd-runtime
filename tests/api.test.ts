import * as api from '../src/index.js'

test('should export the correct API', () => {
  // sdk functions/exports
  expect(api.retry).toBeInstanceOf(Function)
  expect(api.execute).toBeInstanceOf(Function)
  expect(api.processBlock).toBeInstanceOf(Function)
  expect(api.bootstrap).toBeInstanceOf(Function)
  expect(api.ProcessExecutor).toBeDefined()
  expect(api.InProcessExecutor).toBeDefined()
  expect(api.ProjectEvent).toBeDefined()
  expect(api.BlockEvent).toBeDefined()
  expect(api.SystemEvent).toBeDefined()
})
