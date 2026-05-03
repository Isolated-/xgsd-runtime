[**@xgsd/runtime**](../README.md)

***

[@xgsd/runtime](../globals.md) / execute

# Function: execute()

> **execute**\<`T`\>(`run`, `data?`, `opts?`): `Promise`\<\{ `data`: `any`; `error`: `WrappedError`\<`unknown`\>; \}\>

Defined in: [src/sdk.ts:45](https://github.com/Isolated-/xgsd-runtime/blob/5b7060e4b8a8f8f959a86f7202549c2a77d9b99d/src/sdk.ts#L45)

## Type Parameters

### T

`T` *extends* `SourceData` = `SourceData`

## Parameters

### run

`RunFn`\<`T`\>

### data?

`any`

### opts?

[`ExecuteOpts`](../type-aliases/ExecuteOpts.md)

## Returns

`Promise`\<\{ `data`: `any`; `error`: `WrappedError`\<`unknown`\>; \}\>
