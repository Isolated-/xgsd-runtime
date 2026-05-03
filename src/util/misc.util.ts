import {join, resolve} from 'path'

export const defaultWith = <T = unknown>(initial: T, ...others: T[]) => {
  return others.filter(Boolean).shift() ?? initial
}

export const resolvePath = (base: string, ...parts: string[]) => {
  const resolved = resolve(base)
  return join(resolved, ...parts)
}

export const delayFor = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

export const byteSize = (data: unknown): number => {
  if (!data) return 0
  return Buffer.byteLength(JSON.stringify(data ?? ''), 'utf8')
}

export const sizeOf = (value: any): number => {
  if (Buffer.isBuffer(value)) return value.length
  if (typeof value === 'string') return Buffer.byteLength(value)
  if (Array.isArray(value)) return value.reduce((n, v) => n + sizeOf(v), 0)
  if (typeof value === 'object' && value !== null) {
    return Object.values(value).reduce((n: number, v) => n + sizeOf(v), 0) as number
  }
  return 0
}

export function ms(input: string | number): number {
  if (typeof input === 'number') return input

  const match = /^(\d+(?:\.\d+)?)(ms|s|m|h)?$/.exec(input.trim())
  if (!match) return 0

  const value = parseFloat(match[1])
  const unit = match[2] ?? 'ms'

  switch (unit) {
    case 'ms':
      return value
    case 's':
      return value * 1000
    case 'm':
      return value * 60 * 1000
    case 'h':
      return value * 60 * 60 * 1000
    case 'd':
      return value * 24 * 60 * 60 * 1000
    default:
      return value
  }
}
