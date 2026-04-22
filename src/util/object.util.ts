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
