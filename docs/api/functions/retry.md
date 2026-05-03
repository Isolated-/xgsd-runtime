[**@xgsd/runtime**](../README.md)

***

[@xgsd/runtime](../globals.md) / retry

# Function: retry()

> **retry**\<`T`\>(`run`, `data?`, `opts?`, `attempt?`): `Promise`\<\{ `data`: `null`; `error`: `WrappedError`\<`unknown`\>; \} \| \{ `data`: `T`; `error`: `null`; \}\>

Defined in: [src/sdk.ts:27](https://github.com/Isolated-/xgsd-runtime/blob/5b7060e4b8a8f8f959a86f7202549c2a77d9b99d/src/sdk.ts#L27)

retry() is usually called for your blocks inside a child process.

 Use this method when creating new Plugins, Loggers, or Reporters
 to ensure retry logic is built in to your extension.

 Note: do not call retry() from within your blocks.
 This is unneeded and will lead to unexpected results.

## Type Parameters

### T

`T` *extends* `SourceData` = `SourceData`

## Parameters

### run

`RunFn`\<`T`\>

### data?

`T`

### opts?

[`RetryOpts`](../type-aliases/RetryOpts.md)

### attempt?

(`a`) => `void`

## Returns

`Promise`\<\{ `data`: `null`; `error`: `WrappedError`\<`unknown`\>; \} \| \{ `data`: `T`; `error`: `null`; \}\>
