// 组装层 · 版本与升级。
// fetchVersionAPI 按通道选择 Clash /version 或 sing-box gRPC getVersion,
// 并把结果统一成 { data: { version } } 形状。
// 版本字符串是 core 轴(assembly/backend.ts)的唯一来源:这里探测完成后写入 core,
// 后端切换的瞬间先重置为 'unknown',避免沿用上一个后端的结论。
import { fetchClashVersion, restartCoreAPI, upgradeCoreAPI, upgradeUIAPI } from '@/api/clash'
import HonkLogo from '@/assets/images/honk.svg'
import MetacubexLogo from '@/assets/images/metacubex.jpg'
import SingBoxLogo from '@/assets/images/sing-box.svg'
import { MIHOMO, MIHOMO_CHANNEL } from '@/constant'
import { createGenerationGuard } from '@/helper/generationGuard'
import {
  canAutoUpgradeForkUI,
  FORK_UI_RELEASE_API_URL,
  isForkUIUpdateAvailable,
  type ForkUIRelease,
} from '@/helper/uiUpdate'
import { autoUpgradeCore, checkUpgradeCore } from '@/store/settings'
import { activeBackend } from '@/store/setup'
import type { Backend } from '@/types'
import { computed, nextTick, ref, watch } from 'vue'
import { apiVersion, can, Channel, channel, core, Core, resetCore } from './backend'

export const version = ref()
export const isCoreUpdateAvailable = ref(false)
export const zashboardVersion = ref(__APP_VERSION__)

// sing-box 内核启动时刻(ms epoch);0 表示未知 / 当前后端无此能力。
// 仅 sing-box API(GetStartedAt)提供,Clash /version 无运行时长。
export const startedAt = ref(0)

// honk 的 /version 返回 "honk <semver>"(见 honk-core/src/clash_api.rs 的 version handler)。
const detectCore = (versionString: string): Core => {
  if (!versionString) return Core.Unknown
  if (versionString.includes('sing-box')) return Core.Singbox
  if (/\bhonk\b/i.test(versionString)) return Core.Honk
  return Core.Mihomo
}

// 内核品牌的展示信息(logo / 官网链接)。纯展示,不是能力门控,故允许 view 使用。
export const coreBrand = computed(() => {
  switch (core.value) {
    case Core.Singbox:
      return { logo: SingBoxLogo, url: 'https://github.com/sagernet/sing-box' }
    case Core.Honk:
      return { logo: HonkLogo, url: 'https://github.com/Glassyiris/honk' }
    default:
      return {
        logo: MetacubexLogo,
        url: MIHOMO_CHANNEL[mihomo.value?.[0] ?? MIHOMO.Meta].url,
      }
  }
})

export const mihomo = computed<[MIHOMO, string] | undefined>(() => {
  if (core.value !== Core.Mihomo) return undefined

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
  const runtime = await fetchRuntimeVersion(channel.value === Channel.Singbox)

  apiVersion.value = runtime.apiVersion
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
  resetCore()
  version.value = ''
  startedAt.value = 0
  isCoreUpdateAvailable.value = false
}

// 当前后端的内核探测。core 未就绪前依赖它的判断都不可信,
// 需要等结论的调用方(如登录后的设置同步)用 coreReady() 等待。
let probe: Promise<void> = Promise.resolve()

const probeBackend = async (backend: Backend, generation: number) => {
  const isCurrentRequest = () =>
    versionRequestGuard.isCurrent(generation) && activeBackend.value?.uuid === backend.uuid

  try {
    const runtime = await fetchRuntimeVersion(backend.type === 'singbox')
    if (!isCurrentRequest()) return

    version.value = runtime.version
    core.value = detectCore(runtime.version)
    apiVersion.value = runtime.apiVersion

    const backendStartedAt = can('startedAt') ? await fetchSingboxStartedAt() : 0
    if (!isCurrentRequest()) return

    startedAt.value = backendStartedAt
    if (!can('coreUpdateCheck') || !checkUpgradeCore.value || backend.disableUpgradeCore) return

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
}

export const coreReady = async () => {
  // 先让 activeBackend 的 watcher 跑完,确保拿到的是新后端的探测,而非上一次的残留。
  await nextTick()
  await probe
}

watch(
  activeBackend,
  (val) => {
    const generation = versionRequestGuard.next()
    resetVersionState()
    probe = val ? probeBackend(val, generation) : Promise.resolve()
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
