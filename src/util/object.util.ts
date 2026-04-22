import {merge} from 'ts-deepmerge'

export const deepmerge2 = (
  a: Record<string, unknown> = {},
  b: Record<string, unknown> = {},
): Record<string, unknown> => {
  return merge(a, b)
}

export const isEmptyObject = (obj: object | null | undefined): boolean => {
  if (!obj) return true
  return Object.keys(obj).length === 0 && obj.constructor === Object
}
