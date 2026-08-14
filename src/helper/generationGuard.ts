export interface GenerationGuard {
  current: () => number
  isCurrent: (generation: number) => boolean
  next: () => number
}

export const createGenerationGuard = (): GenerationGuard => {
  let generation = 0

  return {
    current: () => generation,
    isCurrent: (candidate) => candidate === generation,
    // 递增令牌使旧异步结果失效。Incrementing invalidates stale async results.
    next: () => ++generation,
  }
}
