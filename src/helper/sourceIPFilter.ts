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
    const label = device ? `${ip} (${device})` : resolveSourceIPLabel(ip)
    addOptionValue(options, label, ip)
  })

  sourceIPLabels.forEach((sourceIPLabel) => {
    if (!isLabelVisibleForBackend(sourceIPLabel, activeBackendID)) return
    if (!ipaddr.isValid(sourceIPLabel.key)) return

    // 中文: 当前连接已有该 IP 时保留运行时 LAN/label 结果; English: avoid duplicate filter options.
    if (options.some((option) => option.value.includes(sourceIPLabel.key))) return

    addOptionValue(options, sourceIPLabel.label, sourceIPLabel.key)
  })

  return options
}
