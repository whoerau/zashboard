import { createSourceIPFilterMatcher } from './sourceIPFilter.ts'

export const shouldRenderTopologySource = (sourceIP: string) => {
  const source = sourceIP.trim()

  return source !== '' && source !== 'Inner'
}

export const filterVisibleSourceEntries = <T extends { key: string }>(entries: readonly T[]) =>
  entries.filter((entry) => shouldRenderTopologySource(entry.key))

export const filterSourceIPHistoryEntries = <T extends { key: string }>(
  entries: readonly T[],
  sourceIPs: readonly string[] | null,
  resolveLanDevice?: (ip: string) => string | undefined,
) => {
  const matchesSourceIP = createSourceIPFilterMatcher(sourceIPs, resolveLanDevice)
  return entries.filter((entry) => matchesSourceIP(entry.key))
}

export const filterConnectionHistoryBySource = <T extends { key: string }>(
  entries: readonly T[],
  sourceIPs: readonly string[] | null,
  isSourceAggregation: boolean,
  resolveLanDevice?: (ip: string) => string | undefined,
) => {
  if (sourceIPs === null) return [...entries]
  // Aggregates without source identity cannot be safely mixed with device-filtered live data.
  // 不含来源身份的历史聚合无法安全地与设备过滤后的实时数据混合。
  return isSourceAggregation
    ? filterSourceIPHistoryEntries(entries, sourceIPs, resolveLanDevice)
    : []
}

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
