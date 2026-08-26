// Keep rule snapshots behind one race-safe facade; upstream now has only Clash.
// 规则快照继续由单一竞态安全门面管理；上游现仅保留 Clash。
import { toggleRuleDisabledAPI, toggleRuleDisabledRefindAPI } from '@/api/clash'
import { RULE_TAB_TYPE } from '@/constant'
import { getBackendScopedSnapshot } from '@/helper/backendSnapshot'
import { createGenerationGuard } from '@/helper/generationGuard'
import {
  createLanDeviceResolver,
  getLanDeviceScopedProxyName,
  LAN_DEVICE_STORAGE_KEYS,
  resolveRulesDeviceSelection,
} from '@/helper/lanDevice'
import {
  filterLanManifestSubRules,
  isLanRulesManifestForRules,
  isLanRulesManifestSameOrigin,
  type LanRulesManifest,
  loadLanRulesManifest,
} from '@/helper/lanRulesManifest'
import { toSearchRegex } from '@/helper/search'
import { useStorage } from '@/helper/storage'
import { getUrlFromBackend } from '@/helper/utils'
import { activeBackend } from '@/store/setup'
import type { Rule, RuleProvider } from '@/types'
import { computed, ref, watch } from 'vue'
import * as clash from './clash'

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
const currentRulesSnapshotKey = computed(() => currentBackendKey.value)
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
export type LanRulesManifestStatus = 'checking' | 'inactive' | 'active' | 'unavailable'
export const lanRulesManifestStatus = ref<LanRulesManifestStatus>('inactive')
export const canUseCoreUIUpdater = computed(() => lanRulesManifestStatus.value === 'inactive')
export const lanRulesDevices = computed(() =>
  getBackendScopedSnapshot(
    lanRulesManifest.value.devices,
    lanRulesManifestSnapshotKey.value,
    currentRulesSnapshotKey.value,
  ),
)

export const waitForLanRulesManifestCheck = () => {
  if (lanRulesManifestStatus.value !== 'checking') return Promise.resolve()

  return new Promise<void>((resolve) => {
    const stop = watch(lanRulesManifestStatus, (status) => {
      if (status === 'checking') return
      stop()
      resolve()
    })
  })
}

const shouldFetchLanRulesManifest = () => {
  const backend = activeBackend.value
  if (!backend) return false
  return isLanRulesManifestSameOrigin(document.baseURI, getUrlFromBackend(backend))
}

// Mark the check pending as soon as a backend changes, before page initialization can await.
// 后端一切换就立即标记待检查，不等页面初始化的异步流程。
watch(
  currentRulesSnapshotKey,
  () => {
    lanRulesManifestStatus.value = shouldFetchLanRulesManifest() ? 'checking' : 'inactive'
  },
  { immediate: true, flush: 'sync' },
)

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
    searchRegex.testAny([
      rule.type,
      rule.payload,
      getLanDeviceScopedProxyName(rule.proxy, rulesDevice.value),
    ]),
  )
})

export const renderRulesProvider = computed(() => {
  const searchRegex = toSearchRegex(rulesFilter.value)
  if (!searchRegex) return [...ruleProviderList.value]

  return ruleProviderList.value.filter((provider) =>
    searchRegex.testAny([provider.name, provider.behavior, provider.vehicleType]),
  )
})

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
  const backendKey = currentBackendKey.value
  const requestSnapshotKey = backendKey

  // Drop a previous backend's data before any new request can fail or race.
  // 在新请求可能失败或竞态前，先丢弃上一后端的数据。
  if (rulesSnapshotKey.value !== requestSnapshotKey) clearRulesSnapshot()

  const shouldFetchManifest = shouldFetchLanRulesManifest()
  lanRulesManifestStatus.value = shouldFetchManifest ? 'checking' : 'inactive'

  const manifestRequest = shouldFetchManifest
    ? loadLanRulesManifest(new URL('lan-rules.json', document.baseURI))
    : Promise.resolve({ status: 'missing' } as const)

  const isCurrentRequest = () =>
    rulesRequestGuard.isCurrent(generation) && currentBackendKey.value === backendKey

  try {
    const [snapshot, manifestResult] = await Promise.all([clash.fetchRules(), manifestRequest])
    if (!isCurrentRequest()) return

    rulesSnapshot.value = snapshot.rules
    ruleProviderSnapshot.value = snapshot.ruleProviderList
    rulesSnapshotKey.value = requestSnapshotKey

    if (
      manifestResult.status === 'loaded' &&
      isLanRulesManifestForRules(manifestResult.manifest, snapshot.rules)
    ) {
      const manifest = manifestResult.manifest
      lanRulesManifest.value = manifest
      lanRulesManifestSnapshotKey.value = requestSnapshotKey
      rulesDevice.value = resolveRulesDeviceSelection(
        rulesDevice.value,
        manifest.devices.map((device) => device.name),
      )
      lanRulesManifestStatus.value = manifest.devices.length ? 'active' : 'inactive'
      return
    }

    if (manifestResult.status !== 'missing') {
      // Existing but invalid/unreadable sidecars must block destructive core UI upgrades.
      // 已存在但无效或不可读的 sidecar 必须阻止破坏性的核心 UI 升级。
      const canKeepPrevious =
        lanRulesManifestSnapshotKey.value === requestSnapshotKey &&
        isLanRulesManifestForRules(lanRulesManifest.value, snapshot.rules)
      if (!canKeepPrevious) {
        lanRulesManifest.value = EMPTY_LAN_RULES_MANIFEST
        lanRulesManifestSnapshotKey.value = ''
      }
      lanRulesManifestStatus.value = 'unavailable'
      return
    }

    lanRulesManifest.value = EMPTY_LAN_RULES_MANIFEST
    lanRulesManifestSnapshotKey.value = ''
    lanRulesManifestStatus.value = 'inactive'
  } catch (error) {
    if (!isCurrentRequest()) return
    lanRulesManifestStatus.value =
      lanRulesManifestSnapshotKey.value === requestSnapshotKey &&
      lanRulesManifest.value.devices.length
        ? 'active'
        : shouldFetchManifest
          ? 'unavailable'
          : 'inactive'
    throw error
  }
}

// 规则启用切换有两套端点: reFind 的规则带稳定 uuid(PUT /rules/{uuid}),
// mihomo 按索引批量切换(PATCH /rules/disable)。用哪套由响应数据自己决定 ——
// rule.uuid 是确定信息,比 core 轴的版本字符串嗅探可靠,故不走能力表。
export const toggleRuleDisabled = (rule: Rule, disabled: boolean) =>
  rule.uuid
    ? toggleRuleDisabledRefindAPI(rule.uuid)
    : toggleRuleDisabledAPI({ [rule.index]: disabled })

export { updateRuleProviderAPI } from '@/api/clash'
