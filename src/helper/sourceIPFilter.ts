import ipaddr from 'ipaddr.js'

type SourceIPLabelLike = {
  key: string
  label: string
  scope?: string[]
}

export type SourceIPOption = {
  label: string
  value: string[]
}

type BuildSourceIPOptionsInput = {
  sourceIPs: readonly string[]
  sourceIPLabels?: readonly SourceIPLabelLike[]
  activeBackendID?: string
  resolveLanDevice?: (ip: string) => string | undefined
  resolveSourceIPLabel?: (ip: string) => string
}

const defaultResolveSourceIPLabel = (ip: string) => (ip === '' ? 'Inner' : ip)

const addOptionValue = (options: SourceIPOption[], label: string, ip: string) => {
  const option = options.find((item) => item.label === label)

  if (!option) {
    options.push({ label, value: [ip] })
    return
  }

  if (!option.value.includes(ip)) {
    option.value.push(ip)
  }
}

const isLabelVisibleForBackend = (sourceIPLabel: SourceIPLabelLike, activeBackendID?: string) =>
  !sourceIPLabel.scope || (!!activeBackendID && sourceIPLabel.scope.includes(activeBackendID))

export const normalizeSourceIP = (ip: string) => {
  if (!ipaddr.isValid(ip)) return ip

  const address = ipaddr.parse(ip)
  return address instanceof ipaddr.IPv6 && address.isIPv4MappedAddress()
    ? address.toIPv4Address().toString()
    : address.toString()
}

export const createSourceIPFilterMatcher = (
  sourceIPs: readonly string[] | null,
  resolveLanDevice?: (ip: string) => string | undefined,
) => {
  if (sourceIPs === null) return () => true

  // Normalize mapped IPv4 so backend wire formats share one filter identity.
  // 规范化 IPv4-mapped 地址，使不同后端格式共享同一筛选身份。
  const normalizedSourceIPs = new Set(sourceIPs.map(normalizeSourceIP))
  const devices = new Set<string>()
  for (const ip of sourceIPs) {
    const device = resolveLanDevice?.(ip)
    if (device) devices.add(device)
  }

  return (ip: string) => {
    if (normalizedSourceIPs.has(normalizeSourceIP(ip))) return true
    const device = resolveLanDevice?.(ip)
    return Boolean(device && devices.has(device))
  }
}

export const buildSourceIPOptions = ({
  sourceIPs,
  sourceIPLabels = [],
  activeBackendID,
  resolveLanDevice,
  resolveSourceIPLabel = defaultResolveSourceIPLabel,
}: BuildSourceIPOptionsInput) => {
  const options: SourceIPOption[] = []

  sourceIPs.forEach((ip) => {
    const device = resolveLanDevice?.(ip)
    const label = device ?? resolveSourceIPLabel(ip)
    addOptionValue(options, label, ip)
  })

  sourceIPLabels.forEach((sourceIPLabel) => {
    if (!isLabelVisibleForBackend(sourceIPLabel, activeBackendID)) return
    if (!ipaddr.isValid(sourceIPLabel.key)) return

    // Preserve the runtime LAN/label result when this IP already has an active connection.
    // 当前连接已有该 IP 时，保留运行时 LAN/label 结果。
    const normalizedKey = normalizeSourceIP(sourceIPLabel.key)
    if (
      options.some((option) => option.value.some((ip) => normalizeSourceIP(ip) === normalizedKey))
    ) {
      return
    }

    addOptionValue(options, sourceIPLabel.label, sourceIPLabel.key)
  })

  return options
}
