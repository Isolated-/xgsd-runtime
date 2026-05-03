import {merge} from 'ts-deepmerge'

export const deepmerge2 = (
  a: Record<string, unknown> | null = {},
  b: Record<string, unknown> | null = {},
): Record<string, unknown> => {
  if (!a && !b) return {}
  if (!a && b) return b
  if (!b && a) return a
  return merge(a!, b!)
}

export const isEmptyObject = (obj: object | null | undefined): boolean => {
  if (!obj) return true
  return Object.keys(obj).length === 0 && obj.constructor === Object
}

const getByPath = (obj: any, path: string[]): any => {
  return path.reduce((acc, key) => acc?.[key], obj)
}

const unwrapRepeatedKey = (value: any, key: string): any => {
  let current = value

  while (current && typeof current === 'object' && key in current) {
    current = current[key]
  }

  return current
}

type MergeOnOptions = {
  unwrap?: 'never' | 'always' | 'auto'
}

/**
 * Merges objects in an array by extracting a specified property path.
 *
 * Supports deep property paths (e.g. `"data.var"`) and optional unwrapping
 * of repeated nested keys.
 *
 * @param property - Dot-notated path to extract from each object
 * @param objects - Source objects to merge
 * @param options.unwrap
 *  - `never`: no unwrapping (default)
 *  - `always`: recursively unwrap repeated keys before merging
 *  - `auto`: unwrap only when structure is consistent
 * @returns Merged object from extracted values
 */
export const mergeOn = <T extends Record<string, any>, R extends Record<string, any> = Record<string, any>>(
  property: string,
  objects: T[],
  options: MergeOnOptions = {unwrap: 'never'},
): R => {
  const {unwrap = 'never'} = options
  const path = property.split('.')

  const shouldAutoUnwrap =
    unwrap === 'auto' &&
    path.length === 1 &&
    objects.every((obj) => {
      const val = obj?.[property]
      return val && typeof val === 'object' && property in val
    })

  const shouldUnwrap = unwrap === 'always' || shouldAutoUnwrap

  const merged = objects.reduce((acc: any, item: T) => {
    let value = getByPath(item, path)

    if (shouldUnwrap) {
      value = unwrapRepeatedKey(value, property)
    }

    return deepmerge2(acc, value ?? {})
  }, {})

  if (shouldAutoUnwrap) {
    return {[property]: merged} as unknown as R
  }

  return merged as R
}
