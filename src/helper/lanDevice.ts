import ipaddr from 'ipaddr.js'

type LanSourceRule = {
  type?: string
  proxy: string
  payload: string
}

export type LanDeviceResolver = (ip: string) => string | undefined

export const LAN_DEVICE_STORAGE_KEYS = {
  proxies: 'config/proxies-lan-device',
  rules: 'config/rules-lan-device',
} as const

export const getValidLanDevice = (device: string, devices: readonly string[]) =>
  devices.includes(device) ? device : ''

export const resolveRulesDeviceSelection = (device: string, devices?: readonly string[]) =>
  devices === undefined ? device : getValidLanDevice(device, devices)

const isReservedLanDeviceSlot = (device: string) => /^slot\d+$/i.test(device)

export const sortLanDeviceNames = (devices: readonly string[]) =>
  [...devices].sort((a, b) => {
    const aIsSlot = isReservedLanDeviceSlot(a)
    const bIsSlot = isReservedLanDeviceSlot(b)
    // Keep reserved slots below named devices.
    // 预留槽排在真实设备后面。
    if (aIsSlot !== bIsSlot) return aIsSlot ? 1 : -1
    return a.localeCompare(b)
  })

export const isProxyGroupInLanDeviceScope = (name: string, device: string) =>
  Boolean(device && name.startsWith(`lan/${device}/`))

export const getLanDeviceFromScopedProxyName = (name: string) =>
  name.match(/^lan\/([^/]+)\//)?.[1] ?? ''

export const getLanDeviceScopedProxyName = (name: string, device: string) => {
  if (!device) return name
  const prefix = `lan/${device}/`
  return name.startsWith(prefix) ? name.slice(prefix.length) : name
}

export const createLanDeviceResolver = (rules: readonly LanSourceRule[]): LanDeviceResolver => {
  const compiled = rules.flatMap((rule) => {
    const device = rule.proxy.match(/^lan\/([^/]+)$/)?.[1]
    const customSource = rule.payload.match(
      /^\(\s*SRC-IP-CIDR6?\s*,\s*([^,\s)]+)(?:\s*,\s*no-resolve)?\s*\)$/i,
    )?.[1]
    const type = rule.type?.replace(/[^a-z0-9]/gi, '').toUpperCase()
    const rawSource =
      type === 'SRCIPCIDR' || type === 'SRCIPCIDR6' ? rule.payload.split(',')[0]?.trim() : undefined
    const source = customSource || rawSource
    if (!device || !source) return []

    try {
      return [{ device, cidr: ipaddr.parseCIDR(source.trim()) }]
    } catch {
      return []
    }
  })
  const cache = new Map<string, string | undefined>()

  return (ip: string) => {
    if (cache.has(ip)) return cache.get(ip)
    if (!ipaddr.isValid(ip)) {
      cache.set(ip, undefined)
      return
    }

    const parsed = ipaddr.parse(ip)
    const address =
      parsed instanceof ipaddr.IPv6 && parsed.isIPv4MappedAddress()
        ? parsed.toIPv4Address()
        : parsed
    const match = compiled.find(
      ({ cidr }) => address.kind() === cidr[0].kind() && address.match(cidr),
    )
    const device = match?.device

    cache.set(ip, device)
    return device
  }
}

export const getLanDeviceName = (ip: string, rules: readonly LanSourceRule[]) =>
  createLanDeviceResolver(rules)(ip)

export const getLanDeviceDisplayName = (
  ip: string,
  rulesOrResolver: readonly LanSourceRule[] | LanDeviceResolver,
  fallback: (ip: string) => string,
) => {
  const device =
    typeof rulesOrResolver === 'function'
      ? rulesOrResolver(ip)
      : getLanDeviceName(ip, rulesOrResolver)
  return device ? `${ip} (${device})` : fallback(ip)
}

const BRACKETED_IPV6_ENDPOINT_RE = /\[([0-9a-f:.]+)\](?=:)/gi
const IPV4_ENDPOINT_RE = /(^|[^\d.])((?:\d{1,3}\.){3}\d{1,3})(?=:)/g

export const labelLanDeviceIPsInLog = (payload: string, resolve: LanDeviceResolver) => {
  // Label only endpoint-shaped addresses so timestamps and unrelated numbers stay untouched.
  // 仅标记端点形式的地址，避免误改时间戳和无关数字。
  const withIPv6Labels = payload.replace(BRACKETED_IPV6_ENDPOINT_RE, (match, ip: string) => {
    const device = resolve(ip)
    return device ? `[${ip}] (${device})` : match
  })

  return withIPv6Labels.replace(IPV4_ENDPOINT_RE, (match, prefix: string, ip: string) => {
    const device = resolve(ip)
    return device ? `${prefix}${ip} (${device})` : match
  })
}
