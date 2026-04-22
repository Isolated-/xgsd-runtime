import {FatalError} from '../../../src'
import {importUserModule, importUserModuleRunFn} from '../../../src/extension/util'
import {join} from 'path'

/**
 *  importUserModule()
 */
test('importUserModule() throws FatalError when module isnt found', async () => {
  const entry = 'invalid'
  await expect(importUserModule({entry} as any)).rejects.toThrow(FatalError)
})

test('importUserModule() should return resolved module', async () => {
  const entry = join(__dirname, '..', '..', 'fixtures', 'valid-user-module.js')

  const mod = await importUserModule({entry} as any)

  expect(mod).toBeDefined()
  expect(mod.testAction).toBeInstanceOf(Function)
})

/**
 *  importUserModuleRunFn()
 */
test('importUserModuleRunFn() should return resolved function', async () => {
  const entry = join(__dirname, '..', '..', 'fixtures', 'valid-user-module.js')

  const fn = await importUserModuleRunFn(
    {
      run: 'testAction',
    } as any,
    {
      entry,
    } as any,
  )

  expect(fn).toBeInstanceOf(Function)

  // not needed but make sure it's actually callable
  expect(await fn({num: 1})).toEqual({num: 1})
})
