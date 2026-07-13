// 组装层 · rules 门面。持有 rules / ruleProviderList 统一状态与渲染派生,
// 按后端类型路由到 clash / singbox 实现(sing-box native 不支持 rules)。
import { isSingboxBackend } from '@/assembly/backend'
import { RULE_TAB_TYPE } from '@/constant'
import { LAN_DEVICE_STORAGE_KEYS, resolveRulesDeviceSelection } from '@/helper/lanDevice'
import { type LanRulesManifest, parseLanRulesManifest } from '@/helper/lanRulesManifest'
import { toSearchRegex } from '@/helper/search'
import type { Rule, RuleProvider } from '@/types'
import { useStorage } from '@vueuse/core'
import { computed, ref } from 'vue'

export const rulesFilter = ref('')
export const rulesTabShow = ref(RULE_TAB_TYPE.RULES)
export const rulesDevice = useStorage<string>(LAN_DEVICE_STORAGE_KEYS.rules, '')

export const rules = ref<Rule[]>([])
export const ruleProviderList = ref<RuleProvider[]>([])

export const lanRulesManifest = ref<LanRulesManifest>({ version: 1, devices: [] })
export const lanRulesDevices = computed(() => lanRulesManifest.value.devices)

const fetchLanRulesManifest = async () => {
  try {
    const response = await fetch(new URL('lan-rules.json', document.baseURI), { cache: 'no-store' })
    if (!response.ok) throw new Error(`HTTP ${response.status}`)
    const manifest = parseLanRulesManifest(await response.json())
    lanRulesManifest.value = manifest
    rulesDevice.value = resolveRulesDeviceSelection(
      rulesDevice.value,
      manifest.devices.map((device) => device.name),
    )
  } catch {
    lanRulesManifest.value = { version: 1, devices: [] }
    // 拉取失败不等于设备已删除。Transport failure does not invalidate persisted scope.
  }
}

const defaultRules = computed(() => {
  const subRules = new Set(lanRulesDevices.value.map((device) => device.subRule))
  return rules.value.filter((rule) => rule.type !== 'SubRules' || !subRules.has(rule.proxy))
})

export const scopedRules = computed<Rule[]>(() => {
  if (!rulesDevice.value) return defaultRules.value

  const device = lanRulesDevices.value.find((item) => item.name === rulesDevice.value)
  if (!device) return defaultRules.value

  const byIndex = new Map(rules.value.map((rule) => [rule.index, rule]))
  return device.rules.flatMap(({ sourceIndex, proxy }) => {
    const source = byIndex.get(sourceIndex)
    if (!source) return []
    return [{ ...source, proxy, disabled: undefined, extra: undefined, readOnly: true }]
  })
})

export const renderRules = computed(() => {
  const searchRegex = toSearchRegex(rulesFilter.value)

  if (!searchRegex) {
    return scopedRules.value
  }

  return scopedRules.value.filter((rule) => {
    return searchRegex.testAny([rule.type, rule.payload, rule.proxy])
  })
})

export const renderRulesProvider = computed(() => {
  const searchRegex = toSearchRegex(rulesFilter.value)

  if (!searchRegex) {
    return ruleProviderList.value
  }

  return ruleProviderList.value.filter((ruleProvider) => {
    return searchRegex.testAny([ruleProvider.name, ruleProvider.behavior, ruleProvider.vehicleType])
  })
})

const load = () => (isSingboxBackend.value ? import('./singbox') : import('./clash'))

export const fetchRules = async () => {
  await Promise.all([(await load()).fetchRules(), fetchLanRulesManifest()])
}

// 规则启用 / 规则集更新动作(Clash 专属),经 rules 域门面暴露给 view。
export {
  toggleRuleDisabledAPI,
  toggleRuleDisabledSingBoxAPI,
  updateRuleProviderAPI,
} from '@/api/clash'
