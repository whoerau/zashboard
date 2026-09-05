// 组装层 · 版本与升级。
// 版本字符串是 core 轴(assembly/backend.ts)的唯一来源:这里探测完成后写入 core,
// 后端切换的瞬间先重置为 'unknown',避免沿用上一个后端的结论。
import { fetchClashVersion, restartCoreAPI, upgradeCoreAPI, upgradeUIAPI } from '@/api/clash'
import HonkLogo from '@/assets/images/honk.svg'
import MetacubexLogo from '@/assets/images/metacubex.jpg'
import { MIHOMO, MIHOMO_CHANNEL } from '@/constant'
import { createGenerationGuard } from '@/helper/generationGuard'
import { getRequestErrorMessage } from '@/helper/requestError'
import {
  FORK_UI_COMPARE_API_URL,
  FORK_UI_RELEASE_API_URL,
  getForkUIReleaseCommit,
  isForkUIUpdateAvailable,
  isSameCommit,
  pickGitHubComparisonCacheData,
  type ForkUIRelease,
  type GitHubComparison,
  type GitHubComparisonStatus,
} from '@/helper/uiUpdate'
import { autoUpgradeCore, autoUpgradeDashboard, checkUpgradeCore } from '@/store/settings'
import { activeBackend } from '@/store/setup'
import type { Backend } from '@/types'
import { computed, nextTick, ref } from 'vue'
import { can, core, Core, resetCore } from './backend'

export const version = ref()
export const isCoreUpdateAvailable = ref(false)
export const zashboardVersion = ref(__APP_VERSION__)

// 切后端时本来就要打一次 /version,顺手把它的结果暴露成连通性状态,
// 给切换提示用 —— 不额外发探测请求,量的也正是实际在用的那条 API。
export type BackendProbe = {
  uuid: string
  status: 'probing' | 'connected' | 'failed'
  // 拿到 /version 响应的耗时(ms),failed 时无意义。
  latency: number
  message: string
}

export const backendProbe = ref<BackendProbe | undefined>()

// honk 的 /version 返回 "honk <semver>"(见 honk-core/src/clash_api.rs 的 version handler)。
const detectCore = (versionString: string): Core => {
  if (!versionString) return Core.Unknown
  if (/\bhonk\b/i.test(versionString)) return Core.Honk
  return Core.Mihomo
}

// 内核品牌的展示信息(logo / 官网链接)。纯展示,不是能力门控,故允许 view 使用。
export const coreBrand = computed(() => {
  switch (core.value) {
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

export const fetchVersionAPI = () => fetchClashVersion()

const versionRequestGuard = createGenerationGuard()

const resetVersionState = () => {
  resetCore()
  version.value = ''
  isCoreUpdateAvailable.value = false
}

// 当前后端的内核探测。core 未就绪前依赖它的判断都不可信,
// 需要等结论的调用方(如登录后的设置同步)用 coreReady() 等待。
let probe: Promise<void> = Promise.resolve()

const probeBackend = async (backend: Backend, generation: number) => {
  const startAt = Date.now()
  const isCurrentRequest = () =>
    versionRequestGuard.isCurrent(generation) && activeBackend.value?.uuid === backend.uuid

  try {
    const { data } = await fetchVersionAPI()
    if (!isCurrentRequest()) return

    version.value = data?.version || ''
    core.value = detectCore(version.value)
    backendProbe.value = {
      uuid: backend.uuid,
      status: 'connected',
      latency: Date.now() - startAt,
      message: '',
    }

    if (!can('coreUpdateCheck') || !checkUpgradeCore.value || backend.disableUpgradeCore) return

    const updateAvailable = await fetchBackendUpdateAvailableAPI().catch((error) => {
      // Update-check failures must not discard a successful backend probe.
      // 更新检查失败不得抹掉已成功探测的后端状态。
      if (isCurrentRequest()) console.warn('Failed to check backend update', error)
      return false
    })
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
    backendProbe.value = {
      uuid: backend.uuid,
      status: 'failed',
      latency: 0,
      message: getRequestErrorMessage(error),
    }
    console.warn('Failed to fetch backend version', error)
  }
}

export const coreReady = async () => {
  // 先让会话的 watcher 跑完,确保拿到的是新后端的探测,而非上一次的残留。
  await nextTick()
  await probe
}

// 由 assembly/session 在每次会话开始时调用:先把上一个后端的结论清干净,
// 再对当前后端重新探测。返回的 promise 只给 coreReady 用,调用方不必等。
export const probeActiveBackend = () => {
  const backend = activeBackend.value
  const generation = versionRequestGuard.next()

  resetVersionState()
  backendProbe.value = backend
    ? { uuid: backend.uuid, status: 'probing', latency: 0, message: '' }
    : undefined

  probe = backend ? probeBackend(backend, generation) : Promise.resolve()
  return probe
}

const CACHE_DURATION = 1000 * 60 * 60

interface CacheEntry<T> {
  timestamp: number
  version: string
  data: T
}

const writeLocalCache = <T>(cacheKey: string, url: string, cache: CacheEntry<T>) => {
  // A cache write must never turn a successful update check into a failure.
  // 缓存写入失败不得让已成功的更新检查变成失败。
  try {
    localStorage.setItem(cacheKey, JSON.stringify(cache))
  } catch (error) {
    console.warn('Failed to cache response for', url, error)
  }
}

async function fetchWithLocalCache<T>(
  url: string,
  version: string,
  selectCacheData: (data: T) => T = (data) => data,
): Promise<T> {
  const cacheKey = 'cache/' + url
  const cacheRaw = localStorage.getItem(cacheKey)

  if (cacheRaw) {
    try {
      const cache: CacheEntry<T> = JSON.parse(cacheRaw)
      const now = Date.now()

      if (now - cache.timestamp < CACHE_DURATION && cache.version === version) {
        const selectedData = selectCacheData(cache.data)
        writeLocalCache(cacheKey, url, { ...cache, data: selectedData })
        return selectedData
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
    data: selectCacheData(data),
  }

  writeLocalCache(cacheKey, url, newCache)
  return data
}

const pruneStaleComparisonCaches = (keepURL: string) => {
  const prefix = `cache/${FORK_UI_COMPARE_API_URL}/`
  const keepKey = `cache/${keepURL}`

  try {
    for (let index = localStorage.length - 1; index >= 0; index--) {
      const key = localStorage.key(index)
      if (key?.startsWith(prefix) && key !== keepKey) localStorage.removeItem(key)
    }
  } catch (error) {
    console.warn('Failed to prune dashboard comparison caches', error)
  }
}

export const fetchIsUIUpdateAvailable = async () => {
  const release = await fetchWithLocalCache<ForkUIRelease>(
    FORK_UI_RELEASE_API_URL,
    `${zashboardVersion.value}/${__COMMIT_ID__ || 'no-commit'}`,
  )
  const releaseCommit = getForkUIReleaseCommit(release)
  let comparisonStatus: GitHubComparisonStatus | undefined
  if (__COMMIT_ID__ && releaseCommit && !isSameCommit(__COMMIT_ID__, releaseCommit)) {
    const comparisonURL = `${FORK_UI_COMPARE_API_URL}/${encodeURIComponent(__COMMIT_ID__)}...${encodeURIComponent(releaseCommit)}`
    pruneStaleComparisonCaches(comparisonURL)
    const comparison = await fetchWithLocalCache<GitHubComparison>(
      comparisonURL,
      `${__COMMIT_ID__}/${releaseCommit}`,
      pickGitHubComparisonCacheData,
    )
    comparisonStatus = comparison.status
  }

  return isForkUIUpdateAvailable(release, __COMMIT_ID__, zashboardVersion.value, comparisonStatus)
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
  if (isUIUpdateAvailable.value && autoUpgradeDashboard.value && can('dashboardUpgrade')) {
    // The gateway owns external-ui-url; managed deployments pin it to this fork's latest release.
    // 下载源由网关管理；受管部署会将其固定到本 fork 的 latest Release。
    void upgradeUIAPI().catch((error) => console.warn('Failed to auto-upgrade dashboard', error))
  }
}

// 内核 / UI 维护动作(Clash 专属,无后端分支),经版本域门面暴露给 view。
export { restartCoreAPI, upgradeCoreAPI, upgradeUIAPI }
