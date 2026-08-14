// Route rule snapshots through one race-safe facade; sing-box has no rule list.
// 通过单一竞态安全门面路由规则快照；sing-box 不提供规则列表。
import { toggleRuleDisabledAPI, toggleRuleDisabledSingBoxAPI } from '@/api/clash'
import { Channel, channel } from '@/assembly/backend'
import { RULE_TAB_TYPE } from '@/constant'
import { getBackendScopedSnapshot } from '@/helper/backendSnapshot'
import { createGenerationGuard } from '@/helper/generationGuard'
import {
  createLanDeviceResolver,
  LAN_DEVICE_STORAGE_KEYS,
  resolveRulesDeviceSelection,
} from '@/helper/lanDevice'
import {
  filterLanManifestSubRules,
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

const currentBackendKey = computed(() => {
  const backend = activeBackend.value
  return backend ? `${backend.uuid}:${getUrlFromBackend(backend)}` : ''
})
const currentRulesSnapshotKey = computed(() => `${channel.value}:${currentBackendKey.value}`)
const rulesSnapshotKey = ref('')
const rulesSnapshot = ref<Rule[]>([])
const ruleProviderSnapshot = ref<RuleProvider[]>([])

export const rules = computed(() =>
  getBackendScopedSnapshot(
    rulesSnapshot.value,
    rulesSnapshotKey.value,
    currentRulesSnapshotKey.value,
  ),
)
export const ruleProviderList = computed(() =>
  getBackendScopedSnapshot(
    ruleProviderSnapshot.value,
    rulesSnapshotKey.value,
    currentRulesSnapshotKey.value,
  ),
)
export const lanDeviceResolver = computed(() => createLanDeviceResolver(rules.value))

export const lanRulesManifest = ref<LanRulesManifest>(EMPTY_LAN_RULES_MANIFEST)
const lanRulesManifestSnapshotKey = ref('')
export const lanRulesDevices = computed(() =>
  getBackendScopedSnapshot(
    lanRulesManifest.value.devices,
    lanRulesManifestSnapshotKey.value,
    currentRulesSnapshotKey.value,
  ),
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

const defaultRules = computed(() => filterLanManifestSubRules(rules.value, lanRulesDevices.value))

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

const clearRulesSnapshot = () => {
  rulesSnapshot.value = []
  ruleProviderSnapshot.value = []
  rulesSnapshotKey.value = ''
  lanRulesManifest.value = EMPTY_LAN_RULES_MANIFEST
  lanRulesManifestSnapshotKey.value = ''
}

export const fetchRules = async () => {
  const generation = rulesRequestGuard.next()
  const requestChannel = channel.value
  const backend = activeBackend.value
  const backendKey = currentBackendKey.value
  const requestSnapshotKey = `${requestChannel}:${backendKey}`
  const backendURL = backend ? getUrlFromBackend(backend) : ''

  // Drop a previous backend's data before any new request can fail or race.
  // 在新请求可能失败或竞态前，先丢弃上一后端的数据。
  if (rulesSnapshotKey.value !== requestSnapshotKey) clearRulesSnapshot()

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

  rulesSnapshot.value = snapshot.rules
  ruleProviderSnapshot.value = snapshot.ruleProviderList
  rulesSnapshotKey.value = requestSnapshotKey

  if (manifest && isLanRulesManifestForRules(manifest, snapshot.rules)) {
    lanRulesManifest.value = manifest
    lanRulesManifestSnapshotKey.value = requestSnapshotKey
    rulesDevice.value = resolveRulesDeviceSelection(
      rulesDevice.value,
      manifest.devices.map((device) => device.name),
    )
    return
  }

  const canKeepPrevious =
    lanRulesManifestSnapshotKey.value === requestSnapshotKey &&
    isLanRulesManifestForRules(lanRulesManifest.value, snapshot.rules)
  if (!canKeepPrevious) {
    lanRulesManifest.value = EMPTY_LAN_RULES_MANIFEST
    lanRulesManifestSnapshotKey.value = ''
  }
}

export const toggleRuleDisabled = (rule: Rule, disabled: boolean) =>
  rule.uuid
    ? toggleRuleDisabledSingBoxAPI(rule.uuid)
    : toggleRuleDisabledAPI({ [rule.index]: disabled })

export { updateRuleProviderAPI } from '@/api/clash'
