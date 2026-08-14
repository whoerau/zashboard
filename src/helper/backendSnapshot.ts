export const getBackendScopedSnapshot = <T>(
  snapshot: readonly T[],
  snapshotKey: string,
  currentKey: string,
): readonly T[] => (snapshotKey === currentKey ? snapshot : [])
