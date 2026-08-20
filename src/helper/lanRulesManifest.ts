import { isProxyGroupInLanDeviceScope } from './lanDevice.ts'

export type LanRuleBinding = {
  sourceIndex: number
  sourceProxy: string
  proxy: string
}

export type LanRulesDevice = {
  name: string
  subRule: string
  rules: LanRuleBinding[]
}

export type LanRulesManifest = {
  version: 2
  ruleCount: number
  rulesDigest: string
  devices: LanRulesDevice[]
}

type ManifestSourceRule = {
  index: number
  payload?: string
  type: string
  proxy: string
}

type SubRuleLike = {
  type: string
  proxy: string
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0

const isLanRuleBinding = (value: unknown): value is LanRuleBinding =>
  isRecord(value) &&
  Number.isInteger(value.sourceIndex) &&
  (value.sourceIndex as number) >= 0 &&
  isNonEmptyString(value.sourceProxy) &&
  isNonEmptyString(value.proxy)

const isLanRulesDevice = (value: unknown): value is LanRulesDevice =>
  isRecord(value) &&
  isNonEmptyString(value.name) &&
  isNonEmptyString(value.subRule) &&
  Array.isArray(value.rules) &&
  value.rules.every(isLanRuleBinding)

export const parseLanRulesManifest = (value: unknown): LanRulesManifest => {
  // Validate every external field before using indexes against live rules.
  // 使用外部索引匹配实时规则前，必须完整验证所有字段。
  if (
    !isRecord(value) ||
    value.version !== 2 ||
    !Number.isInteger(value.ruleCount) ||
    (value.ruleCount as number) < 0 ||
    typeof value.rulesDigest !== 'string' ||
    !/^[0-9a-f]{16}$/.test(value.rulesDigest) ||
    !Array.isArray(value.devices) ||
    !value.devices.every(isLanRulesDevice)
  ) {
    throw new TypeError('invalid LAN rules manifest')
  }

  const manifest = value as LanRulesManifest
  const deviceNames = manifest.devices.map((device) => device.name)
  const subRules = manifest.devices.map((device) => device.subRule)
  const referenceSources = manifest.devices[0]?.rules.map(
    ({ sourceIndex, sourceProxy }) => `${sourceIndex}\0${sourceProxy}`,
  )
  const hasInvalidDevice = manifest.devices.some((device) => {
    const sourceIndexes = device.rules.map((rule) => rule.sourceIndex)
    const sources = device.rules.map(
      ({ sourceIndex, sourceProxy }) => `${sourceIndex}\0${sourceProxy}`,
    )
    // Allow shared passthrough policies or this device's cloned selectors only.
    // 仅允许共享直通策略或当前设备的克隆选择器。
    const hasInvalidProxy = device.rules.some(
      ({ sourceProxy, proxy }) =>
        proxy !== sourceProxy && !isProxyGroupInLanDeviceScope(proxy, device.name),
    )
    return (
      device.subRule !== `lan/${device.name}` ||
      new Set(sourceIndexes).size !== sourceIndexes.length ||
      sources.some((source, index) => source !== referenceSources?.[index]) ||
      sources.length !== (referenceSources?.length ?? 0) ||
      hasInvalidProxy
    )
  })
  if (
    new Set(deviceNames).size !== deviceNames.length ||
    new Set(subRules).size !== subRules.length ||
    hasInvalidDevice
  ) {
    throw new TypeError('invalid LAN rules manifest')
  }

  return manifest
}

export const createLanRulesDigest = (
  rules: readonly ManifestSourceRule[],
  sourceIndexes: readonly number[],
) => {
  // Mirror the generator's UTF-8 FNV-1a identity without exposing raw payloads.
  // 与生成器使用同一 UTF-8 FNV-1a 身份摘要，避免暴露原始 payload。
  const byIndex = new Map(rules.map((rule) => [rule.index, rule]))
  const canonical = sourceIndexes
    .map((sourceIndex) => {
      const source = byIndex.get(sourceIndex)
      return `${sourceIndex}\0${source?.payload ?? ''}\0${source?.proxy ?? ''}`
    })
    .join('\n')
  let hash = 14695981039346656037n
  for (const byte of new TextEncoder().encode(canonical)) {
    hash ^= BigInt(byte)
    hash = BigInt.asUintN(64, hash * 1099511628211n)
  }
  return hash.toString(16).padStart(16, '0')
}

export const isLanRulesManifestForRules = (
  manifest: LanRulesManifest,
  rules: readonly ManifestSourceRule[],
) => {
  if (manifest.ruleCount !== rules.length) return false

  const byIndex = new Map(rules.map((rule) => [rule.index, rule]))
  const sourceIndexes = manifest.devices[0]?.rules.map((rule) => rule.sourceIndex) ?? []
  if (createLanRulesDigest(rules, sourceIndexes) !== manifest.rulesDigest) return false

  return manifest.devices.every(
    (device) =>
      rules.some((rule) => rule.type === 'SubRules' && rule.proxy === device.subRule) &&
      device.rules.every(({ sourceIndex, sourceProxy, proxy }) => {
        const source = byIndex.get(sourceIndex)
        const proxyIsDeviceScoped =
          proxy === sourceProxy || isProxyGroupInLanDeviceScope(proxy, device.name)
        return source?.proxy === sourceProxy && proxyIsDeviceScoped
      }),
  )
}

export const isLanRulesManifestSameOrigin = (documentBaseURI: string, backendURL: string) => {
  try {
    return new URL(documentBaseURI).origin === new URL(backendURL).origin
  } catch {
    return false
  }
}

export const filterLanManifestSubRules = <T extends SubRuleLike>(
  rules: readonly T[],
  devices: readonly Pick<LanRulesDevice, 'subRule'>[],
) => {
  const lanSubRules = new Set(devices.map((device) => device.subRule))
  return rules.filter((rule) => rule.type !== 'SubRules' || !lanSubRules.has(rule.proxy))
}
