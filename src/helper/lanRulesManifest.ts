export type LanRuleBinding = {
  sourceIndex: number
  proxy: string
}

export type LanRulesDevice = {
  name: string
  source: string
  subRule: string
  rules: LanRuleBinding[]
}

export type LanRulesManifest = {
  version: 1
  devices: LanRulesDevice[]
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  typeof value === 'object' && value !== null && !Array.isArray(value)

const isNonEmptyString = (value: unknown): value is string =>
  typeof value === 'string' && value.trim().length > 0

const isLanRuleBinding = (value: unknown): value is LanRuleBinding =>
  isRecord(value) &&
  Number.isInteger(value.sourceIndex) &&
  (value.sourceIndex as number) >= 0 &&
  isNonEmptyString(value.proxy)

const isLanRulesDevice = (value: unknown): value is LanRulesDevice =>
  isRecord(value) &&
  isNonEmptyString(value.name) &&
  isNonEmptyString(value.source) &&
  isNonEmptyString(value.subRule) &&
  Array.isArray(value.rules) &&
  value.rules.every(isLanRuleBinding)

export const parseLanRulesManifest = (value: unknown): LanRulesManifest => {
  // 外部清单必须整棵验证，避免渲染期才因嵌套字段崩溃。
  // Validate the complete external manifest before render-time use.
  if (
    !isRecord(value) ||
    value.version !== 1 ||
    !Array.isArray(value.devices) ||
    !value.devices.every(isLanRulesDevice)
  ) {
    throw new TypeError('invalid LAN rules manifest')
  }

  return value as LanRulesManifest
}
