// Route rule snapshots through one race-safe facade; sing-box has no rule list.
// 通过单一竞态安全门面路由规则快照；sing-box 不提供规则列表。
import { toggleRuleDisabledAPI, toggleRuleDisabledSingBoxAPI } from '@/api/clash'
import { Channel, channel } from '@/assembly/backend'
import { RULE_TAB_TYPE } from '@/constant'
import { createGenerationGuard } from '@/helper/generationGuard'
import {
  createLanDeviceResolver,
  LAN_DEVICE_STORAGE_KEYS,
  resolveRulesDeviceSelection,
} from '@/helper/lanDevice'
import {
  isLanRulesManifestForRules,
  isLanRulesManifestSameOrigin,
  type LanRulesManifest,
  parseLanRulesManifest,
} from '@/helper/lanRulesManifest'
import { toSearchRegex } from '@/helper/search'
import { getUrlFromBackend } from '@/helper/utils'
import { activeBackend } from '@/store/setup'
import type { Rule, RuleProvider } from '@/types'
import { useStorage } from '@vueuse/core'
import { computed, ref } from 'vue'

const EMPTY_LAN_RULES_MANIFEST: LanRulesManifest = {
  version: 2,
  ruleCount: 0,
  rulesDigest: 'cbf29ce484222325',
  devices: [],
}

export const rulesFilter = ref('')
export const rulesTabShow = ref(RULE_TAB_TYPE.RULES)
export const rulesDevice = useStorage<string>(LAN_DEVICE_STORAGE_KEYS.rules, '')

export const rules = ref<Rule[]>([])
export const ruleProviderList = ref<RuleProvider[]>([])
export const lanDeviceResolver = computed(() => createLanDeviceResolver(rules.value))

export const lanRulesManifest = ref<LanRulesManifest>(EMPTY_LAN_RULES_MANIFEST)
const lanRulesManifestBackend = ref('')
const currentBackendKey = computed(() => {
  const backend = activeBackend.value
  return backend ? `${backend.uuid}:${getUrlFromBackend(backend)}` : ''
})
export const lanRulesDevices = computed(() =>
  lanRulesManifestBackend.value === currentBackendKey.value ? lanRulesManifest.value.devices : [],
)

const fetchLanRulesManifest = async (backendURL: string) => {
  if (!isLanRulesManifestSameOrigin(document.baseURI, backendURL)) return

  try {
    const response = await fetch(new URL('lan-rules.json', document.baseURI), { cache: 'no-store' })
    if (!response.ok) return
    return parseLanRulesManifest(await response.json())
  } catch {
    return
  }
}

const defaultRules = computed(() => rules.value.filter((rule) => rule.type !== 'SubRules'))

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
  if (!searchRegex) return scopedRules.value

  return scopedRules.value.filter((rule) =>
    searchRegex.testAny([rule.type, rule.payload, rule.proxy]),
  )
})

export const renderRulesProvider = computed(() => {
  const searchRegex = toSearchRegex(rulesFilter.value)
  if (!searchRegex) return ruleProviderList.value

  return ruleProviderList.value.filter((provider) =>
    searchRegex.testAny([provider.name, provider.behavior, provider.vehicleType]),
  )
})

const load = (requestChannel: Channel) =>
  requestChannel === Channel.Singbox ? import('./singbox') : import('./clash')

const rulesRequestGuard = createGenerationGuard()

export const fetchRules = async () => {
  const generation = rulesRequestGuard.next()
  const requestChannel = channel.value
  const backend = activeBackend.value
  const backendKey = currentBackendKey.value
  const backendURL = backend ? getUrlFromBackend(backend) : ''
  const manifestRequest =
    requestChannel === Channel.Clash && backendURL
      ? fetchLanRulesManifest(backendURL)
      : Promise.resolve(undefined)

  const [snapshot, manifest] = await Promise.all([
    (await load(requestChannel)).fetchRules(),
    manifestRequest,
  ])
  const isCurrent =
    rulesRequestGuard.isCurrent(generation) &&
    channel.value === requestChannel &&
    currentBackendKey.value === backendKey
  if (!isCurrent) return

  rules.value = snapshot.rules
  ruleProviderList.value = snapshot.ruleProviderList

  if (manifest && isLanRulesManifestForRules(manifest, snapshot.rules)) {
    lanRulesManifest.value = manifest
    lanRulesManifestBackend.value = backendKey
    rulesDevice.value = resolveRulesDeviceSelection(
      rulesDevice.value,
      manifest.devices.map((device) => device.name),
    )
    return
  }

  const canKeepPrevious =
    lanRulesManifestBackend.value === backendKey &&
    isLanRulesManifestForRules(lanRulesManifest.value, snapshot.rules)
  if (!canKeepPrevious) {
    lanRulesManifest.value = EMPTY_LAN_RULES_MANIFEST
    lanRulesManifestBackend.value = ''
  }
}

export const toggleRuleDisabled = (rule: Rule, disabled: boolean) =>
  rule.uuid
    ? toggleRuleDisabledSingBoxAPI(rule.uuid)
    : toggleRuleDisabledAPI({ [rule.index]: disabled })

export { updateRuleProviderAPI } from '@/api/clash'
