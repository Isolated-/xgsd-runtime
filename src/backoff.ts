export const linearBackoff = (attempt: number, base: number = 1000): number => {
  return base * attempt
}

export const squaringBackoff = (attempt: number, base: number = 1000): number => {
  return base * (attempt * attempt)
}

export const exponentialBackoff = (attempt: number, base: number = 1000): number => {
  return base * 2 ** attempt
}

export const manualBackoff = (attempt: number, base: number = 1000): number => {
  return base
}

export const strategyMap: Record<string, (attempt: number, base?: number) => number> = {
  manual: manualBackoff,
  linear: linearBackoff,
  exponential: exponentialBackoff,
  squaring: squaringBackoff,
}

export const getBackoffStrategy = (strategy: string) => {
  return strategyMap[strategy] || exponentialBackoff
}

export const DEFAULT_BACKOFF_STRATEGY = exponentialBackoff
