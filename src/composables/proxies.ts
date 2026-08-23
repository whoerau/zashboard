import { can } from '@/assembly/backend'
import { configs } from '@/assembly/config'
import {
  getProxyGroupChains,
  proxiesDevice,
  proxiesTabShow,
  proxyGroupList,
  proxyMap,
  proxyProviederList,
} from '@/assembly/proxies'
import { GLOBAL, PROXY_TAB_TYPE } from '@/constant'
import { isHiddenGroup } from '@/helper'
import { isProxyGroupInLanDeviceScope } from '@/helper/lanDevice'
import { groupsInActiveFolder, isProxyFolderModeActive } from '@/store/proxyFolders'
import { customGlobalNode, displayGlobalByMode, manageHiddenGroup } from '@/store/settings'
import { isEmpty } from 'lodash'
import { computed, ref } from 'vue'
import {
  isProxyNodeSearchMode,
  matchLanDeviceProxySearchKeyword,
  matchProxySearchKeyword,
  proxyGroupContainsMatchingNode,
  proxyProviderContainsMatchingNode,
  proxySearchKeyword,
} from './proxySearch'

const filterProxyGroups = (groups: string[], respectHiddenGroups = true) => {
  const scopedGroups = proxiesDevice.value
    ? groups.filter((name) => isProxyGroupInLanDeviceScope(name, proxiesDevice.value))
    : groups

  if (!proxySearchKeyword.value) {
    if (!respectHiddenGroups || manageHiddenGroup.value || proxiesDevice.value) {
      return scopedGroups
    }

    return scopedGroups.filter((name) => !isHiddenGroup(name))
  }

  const matchesGroup = isProxyNodeSearchMode.value
    ? (name: string) => proxyGroupContainsMatchingNode(name, proxiesDevice.value)
    : (name: string) => matchLanDeviceProxySearchKeyword(name, proxiesDevice.value)

  return scopedGroups.filter(matchesGroup)
}

const getRenderProxyGroups = () => {
  if (isEmpty(proxyMap.value)) {
    return []
  }

  if (proxiesDevice.value) {
    return filterProxyGroups(proxyGroupList.value)
  }

  if (displayGlobalByMode.value) {
    if (configs.value?.mode.toUpperCase() === GLOBAL) {
      const globalName =
        can('customGlobalNode') && proxyMap.value[customGlobalNode.value]
          ? customGlobalNode.value
          : GLOBAL

      return filterProxyGroups(getProxyGroupChains(globalName), false)
    }

    return filterProxyGroups(proxyGroupList.value)
  }

  // sing-box 没有 GLOBAL 组,仅在其确实存在时才追加,避免渲染空组崩溃。
  const globalGroups = proxyMap.value[GLOBAL] ? [GLOBAL] : []
  return filterProxyGroups([...proxyGroupList.value, ...globalGroups])
}

const getRenderProxyProviders = () => {
  const names = proxyProviederList.value.map((provider) => provider.name)

  if (!proxySearchKeyword.value) {
    return names
  }

  const matches = isProxyNodeSearchMode.value
    ? proxyProviderContainsMatchingNode
    : (name: string) => matchProxySearchKeyword(name)

  return names.filter(matches)
}

const limitInitialRender = (names: string[]) => {
  if (isProxiesPageMounted.value) {
    return names
  }

  return names.slice(0, 16)
}

export const disableProxiesPageScroll = ref(false)
export const isProxiesPageMounted = ref(false)

export const filteredProxyGroups = computed(() => getRenderProxyGroups())

export const renderProxyGroups = computed(() => {
  return limitInitialRender(filteredProxyGroups.value)
})

export const renderProxyProviders = computed(() => {
  return limitInitialRender(getRenderProxyProviders())
})

export const renderProxiesPageItems = computed(() => {
  if (proxiesTabShow.value === PROXY_TAB_TYPE.PROVIDER) {
    return renderProxyProviders.value
  }

  const groups = renderProxyGroups.value
  if (!isProxyFolderModeActive.value) return groups
  const filter = groupsInActiveFolder.value
  if (!filter) return groups
  return groups.filter((name) => filter.has(name))
})
