export const shouldRenderTopologySource = (sourceIP: string) => {
  const source = sourceIP.trim()

  return source !== '' && source !== 'Inner'
}

export const filterVisibleSourceEntries = <T extends { key: string }>(entries: readonly T[]) =>
  entries.filter((entry) => shouldRenderTopologySource(entry.key))

type ConnectionHistoryEntry = {
  key: string
  download: number
  upload: number
  count: number
}

export const buildConnectionHistoryView = <T extends ConnectionHistoryEntry>(
  entries: readonly T[],
  hideInternalSources: boolean,
) => {
  // 可见行可过滤，但总计必须覆盖全部流量。Filter rows, never accounting totals.
  const totals = entries.reduce(
    (acc, entry) => {
      acc.download += entry.download
      acc.upload += entry.upload
      acc.count += entry.count
      return acc
    },
    { download: 0, upload: 0, count: 0 },
  )

  return {
    rows: hideInternalSources ? filterVisibleSourceEntries(entries) : [...entries],
    totals,
  }
}
