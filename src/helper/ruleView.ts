type DisplayRule = {
  readOnly?: boolean
}

export const getRuleDisplayNumber = <T extends DisplayRule>(
  rule: T,
  visibleIndex: number,
  sourceRules: readonly T[],
) => {
  if (rule.readOnly) return visibleIndex + 1

  const sourceIndex = sourceRules.indexOf(rule)
  // 普通规则保留源位置；合成/未知规则回退到可见位置。Keep source positions when available.
  return sourceIndex >= 0 ? sourceIndex + 1 : visibleIndex + 1
}
