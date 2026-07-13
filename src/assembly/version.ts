// 组装层 · 版本与升级。
// fetchVersionAPI 按后端类型选择 Clash /version 或 sing-box gRPC getVersion,
// 并把结果统一成 { data: { version } } 形状。
// isSingBoxCore 基于「运行时内核版本字符串」,与 assembly/backend.ts 的 isSingboxBackend
//(基于配置类型)语义不同:Clash 通道也可能连到 sing-box 兼容核心。
import { fetchClashVersion, restartCoreAPI, upgradeCoreAPI, upgradeUIAPI } from '@/api/clash'
import { MIHOMO, MIHOMO_CHANNEL } from '@/constant'
import { createGenerationGuard } from '@/helper/generationGuard'
import {
  FORK_UI_RELEASE_API_URL,
  type ForkUIRelease,
  canAutoUpgradeForkUI,
  isForkUIUpdateAvailable,
} from '@/helper/uiUpdate'
import { autoUpgradeCore, checkUpgradeCore } from '@/store/settings'
import { activeBackend } from '@/store/setup'
import { computed, ref, watch } from 'vue'
import { isSingboxBackend } from './backend'

export const version = ref()
export const isCoreUpdateAvailable = ref(false)
export const zashboardVersion = ref(__APP_VERSION__)

// sing-box gRPC API version (0 when unknown / non-sing-box). Gates capabilities
// such as usbip, which requires apiVersion >= 2.
export const singboxApiVersion = ref(0)

// sing-box 内核启动时刻(ms epoch);0 表示未知 / 当前后端无此能力。
// 仅 sing-box native gRPC(GetStartedAt)提供,Clash /version 无运行时长。
export const startedAt = ref(0)

export const isSingBoxCore = computed(() => version.value?.includes('sing-box'))

export const mihomo = computed<[MIHOMO, string] | undefined>(() => {
  if (isSingBoxCore.value) return undefined
  else {
    const match = /(alpha-smart|alpha|beta|meta)-?(\w+)/.exec(version.value)
    switch (match?.[1]) {
      case 'alpha':
        return [MIHOMO.Alpha, match[2] ?? version.value]
      case 'alpha-smart':
        return [MIHOMO.Smart, match[2] ?? version.value]
      case 'meta':
        return [MIHOMO.Meta, match[2] ?? version.value]
      default:
        return [MIHOMO.Meta, version.value]
    }
  }
})

interface RuntimeVersion {
  version: string
  apiVersion: number
}

const fetchSingboxVersion = async (): Promise<RuntimeVersion> => {
  const { getSingboxClient } = await import('@/api/singbox/client')
  const client = getSingboxClient()?.client
  if (!client) return { version: 'sing-box', apiVersion: 0 }
  const v = await client.getVersion({})
  const version = v.version.includes('sing-box') ? v.version : `sing-box ${v.version}`
  return { version, apiVersion: v.apiVersion }
}

const fetchRuntimeVersion = async (singboxBackend: boolean): Promise<RuntimeVersion> => {
  if (singboxBackend) return fetchSingboxVersion()

  const { data } = await fetchClashVersion()
  return { version: data.version, apiVersion: 0 }
}

export const fetchVersionAPI = async () => {
  const runtime = await fetchRuntimeVersion(isSingboxBackend.value)

  singboxApiVersion.value = runtime.apiVersion
  return { data: { version: runtime.version } }
}

const fetchSingboxStartedAt = async (): Promise<number> => {
  const { getSingboxClient } = await import('@/api/singbox/client')
  const client = getSingboxClient()?.client
  if (!client) return 0
  try {
    const res = await client.getStartedAt({})
    return Number(res.startedAt)
  } catch {
    return 0
  }
}

const versionRequestGuard = createGenerationGuard()

const resetVersionState = () => {
  version.value = ''
  singboxApiVersion.value = 0
  startedAt.value = 0
  isCoreUpdateAvailable.value = false
}

watch(
  activeBackend,
  async (val) => {
    const generation = versionRequestGuard.next()

    if (!val) {
      resetVersionState()
      return
    }

    const backendUUID = val.uuid
    const singboxBackend = val.type === 'singbox'
    const isCurrentRequest = () =>
      versionRequestGuard.isCurrent(generation) && activeBackend.value?.uuid === backendUUID

    resetVersionState()

    try {
      const runtime = await fetchRuntimeVersion(singboxBackend)
      if (!isCurrentRequest()) return

      version.value = runtime.version
      singboxApiVersion.value = runtime.apiVersion

      const backendStartedAt = singboxBackend ? await fetchSingboxStartedAt() : 0
      if (!isCurrentRequest()) return

      startedAt.value = backendStartedAt
      if (
        runtime.version.includes('sing-box') ||
        !checkUpgradeCore.value ||
        val.disableUpgradeCore
      ) {
        isCoreUpdateAvailable.value = false
        return
      }

      const updateAvailable = await fetchBackendUpdateAvailableAPI()
      if (!isCurrentRequest()) return

      isCoreUpdateAvailable.value = updateAvailable
      if (updateAvailable && autoUpgradeCore.value) {
        // 升级前再次确认后端，绝不让旧请求升级新后端。
        // Recheck before upgrade so a stale request never upgrades a new backend.
        if (isCurrentRequest()) void upgradeCoreAPI('auto')
      }
    } catch (error) {
      if (!isCurrentRequest()) return

      resetVersionState()
      console.warn('Failed to fetch backend version', error)
    }
  },
  { immediate: true },
)

const CACHE_DURATION = 1000 * 60 * 60

interface CacheEntry<T> {
  timestamp: number
  version: string
  data: T
}

async function fetchWithLocalCache<T>(url: string, version: string): Promise<T> {
  const cacheKey = 'cache/' + url
  const cacheRaw = localStorage.getItem(cacheKey)

  if (cacheRaw) {
    try {
      const cache: CacheEntry<T> = JSON.parse(cacheRaw)
      const now = Date.now()

      if (now - cache.timestamp < CACHE_DURATION && cache.version === version) {
        return cache.data
      } else {
        localStorage.removeItem(cacheKey)
      }
    } catch (e) {
      console.warn('Failed to parse cache for', url, e)
    }
  }

  const response = await fetch(url)
  if (!response.ok) {
    throw new Error(`Fetch failed: ${response.status} ${response.statusText}`)
  }

  const data: T = await response.json()
  const newCache: CacheEntry<T> = {
    timestamp: Date.now(),
    version,
    data,
  }

  localStorage.setItem(cacheKey, JSON.stringify(newCache))
  return data
}

export const fetchIsUIUpdateAvailable = async () => {
  const release = await fetchWithLocalCache<ForkUIRelease>(
    FORK_UI_RELEASE_API_URL,
    `${zashboardVersion.value}/${__COMMIT_ID__ || 'no-commit'}`,
  )

  return isForkUIUpdateAvailable(release, __COMMIT_ID__, zashboardVersion.value)
}

const check = async (url: string, versionNumber: string) => {
  const { assets } = await fetchWithLocalCache<{ assets: { name: string }[] }>(url, versionNumber)
  const alreadyLatest = assets.some(({ name }) => name.includes(versionNumber))

  return !alreadyLatest
}

export const fetchBackendUpdateAvailableAPI = async () => {
  return await check(
    MIHOMO_CHANNEL[mihomo.value?.[0] ?? MIHOMO.Meta].check_update_url,
    mihomo.value?.[1] ?? version.value,
  )
}

// 仪表盘(UI)更新检查,迁自 composables/settings.ts 的 useSettings。
export const isUIUpdateAvailable = ref(false)

export const checkUIUpdate = async () => {
  isUIUpdateAvailable.value = await fetchIsUIUpdateAvailable()
  // Mihomo /configs 不暴露 external-ui-url，无法安全证明下载源。Never auto-update unverified UI.
  if (isUIUpdateAvailable.value && canAutoUpgradeForkUI()) {
    upgradeUIAPI()
  }
}

// 内核 / UI 维护动作(Clash 专属,无后端分支),经版本域门面暴露给 view。
export { restartCoreAPI, upgradeCoreAPI, upgradeUIAPI }
