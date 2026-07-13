import ipaddr from 'ipaddr.js'

type LanSourceRule = {
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
    // 预留槽排在真实设备后面。Keep reserved slots below named devices.
    if (aIsSlot !== bIsSlot) return aIsSlot ? 1 : -1
    return a.localeCompare(b)
  })

export const getLanDeviceFilter = (device: string) => {
  if (!device) return ''
  // 设备名进入正则前必须转义，避免改变搜索语义。Escape device names before regex use.
  const escaped = device.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
  return `^lan/${escaped}/`
}

export const isLanDeviceFilter = (filter: string, device: string) =>
  Boolean(device && filter.trim() === getLanDeviceFilter(device))

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
    const source = rule.payload.match(/^\(\s*SRC-IP-CIDR\s*,\s*([^)]+)\)$/i)?.[1]
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

    const address = ipaddr.parse(ip)
    const match = compiled.find(
      ({ cidr }) => address.kind() === cidr[0].kind() && address.match(cidr),
    )
    const device = match?.device

    // 同一 rules snapshot 内缓存命中与未命中。Cache hits and misses per rules snapshot.
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
