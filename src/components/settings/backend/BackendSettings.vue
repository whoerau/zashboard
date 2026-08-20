<template>
  <!-- backend -->
  <div
    v-if="hasVisibleItems"
    class="flex flex-col gap-3 text-sm"
  >
    <div class="flex items-center gap-2 px-1">
      <div class="indicator">
        <span
          v-if="isCoreUpdateAvailable"
          class="indicator-item top-1 -right-1 flex"
        >
          <span class="bg-secondary absolute h-2 w-2 animate-ping rounded-full"></span>
          <span class="bg-secondary h-2 w-2 rounded-full"></span>
        </span>
        <a
          class="flex cursor-pointer items-center gap-2 text-lg font-semibold"
          :href="coreBrand.url"
          target="_blank"
        >
          {{ $t('backend') }}
          <BackendVersion class="text-sm font-normal" />
        </a>
      </div>
    </div>

    <div
      class="settings-grid"
      v-if="hasVisibleActions || isVisibleBackendSwitch || showDnsQuery"
    >
      <SettingItem
        :setting-key="k.backend"
        class="p-4"
      >
        <BackendSwitch :show-actions="false" />
      </SettingItem>

      <SettingItem
        v-for="action in backendActions"
        :key="action.key"
        :setting-key="action.key"
      >
        <div class="setting-item-label">
          {{ $t(action.label) }}
        </div>
        <button
          :class="['btn btn-sm', action.key === k.upgradeCore && 'btn-neutral']"
          :disabled="action.running"
          @click="action.run()"
        >
          <span
            v-if="action.running"
            class="loading loading-spinner h-4 w-4"
          ></span>
          <component
            v-else
            :is="action.icon"
            class="h-4 w-4"
          />
        </button>
      </SettingItem>

      <SettingItem
        :setting-key="k.DNSQuery"
        :when="can('dnsQuery')"
        class="py-3"
      >
        <div class="flex w-full flex-col">
          <div class="settings-section-label">
            {{ $t('DNSQuery') }}
          </div>
          <DnsQuery />
        </div>
      </SettingItem>
    </div>

    <div
      v-if="can('configPatch') && configs && hasVisibleSettings"
      class="grid"
    >
      <div class="settings-section-label">
        {{ $t('settings') }}
      </div>
      <div class="settings-grid">
        <SettingItem
          :setting-key="k.ports"
          class="py-3"
        >
          <div class="flex w-full flex-col">
            <BackendPortsGrid />
          </div>
        </SettingItem>
        <SettingItem
          :setting-key="k.tunMode"
          :when="!!configs?.tun && !activeBackend?.disableTunMode"
        >
          <div class="setting-item-label">
            {{ $t('tunMode') }}
          </div>
          <input
            class="toggle"
            type="checkbox"
            v-model="configs!.tun.enable"
            @change="hanlderTunModeChange"
          />
        </SettingItem>
        <SettingItem
          :setting-key="k.allowLan"
          :when="!!configs"
        >
          <div class="setting-item-label">
            {{ $t('allowLan') }}
          </div>
          <input
            class="toggle"
            type="checkbox"
            v-model="configs!['allow-lan']"
            @change="handlerAllowLanChange"
          />
        </SettingItem>
        <template v-if="!activeBackend?.disableUpgradeCore">
          <SettingItem :setting-key="k.checkCoreUpgrade">
            <div class="setting-item-label">
              {{ $t('checkCoreUpgrade') }}
            </div>
            <input
              class="toggle"
              type="checkbox"
              v-model="checkUpgradeCore"
              @change="handlerCheckUpgradeCoreChange"
            />
          </SettingItem>
          <SettingItem
            :setting-key="k.autoUpgradeCore"
            :when="checkUpgradeCore"
          >
            <div class="setting-item-label">
              {{ $t('autoUpgradeCore') }}
            </div>
            <input
              class="toggle"
              type="checkbox"
              v-model="autoUpgradeCore"
            />
          </SettingItem>
        </template>
      </div>
    </div>
  </div>
</template>

<script setup lang="ts">
import { can } from '@/assembly/backend'
import { configs, updateConfigs } from '@/assembly/config'
import { coreBrand, isCoreUpdateAvailable } from '@/assembly/version'
import BackendVersion from '@/components/common/BackendVersion.vue'
import BackendPortsGrid from '@/components/settings/backend/BackendPortsGrid.vue'
import BackendSwitch from '@/components/settings/backend/BackendSwitch.vue'
import DnsQuery from '@/components/settings/backend/DnsQuery.vue'
import SettingItem from '@/components/settings/SettingItem.vue'
import { backendActions } from '@/composables/backendActions'
import { isSettingVisible, useIsSettingVisible } from '@/composables/settings'
import { BACKEND_ITEM_KEYS } from '@/config/settingsItems'
import { notifyRequestError } from '@/helper/requestError'
import { autoUpgradeCore, checkUpgradeCore } from '@/store/settings'
import { activeBackend } from '@/store/setup'
import { computed } from 'vue'

const k = BACKEND_ITEM_KEYS
const isVisibleBackendSwitch = useIsSettingVisible(k.backend)
const isVisiblePorts = useIsSettingVisible(k.ports)
const isVisibleTunMode = useIsSettingVisible(k.tunMode)
const isVisibleAllowLan = useIsSettingVisible(k.allowLan)
const isVisibleCheckUpgrade = useIsSettingVisible(k.checkCoreUpgrade)
const isVisibleAutoUpgrade = useIsSettingVisible(k.autoUpgradeCore)
const isVisibleDnsQuery = useIsSettingVisible(k.DNSQuery)
const canShowTunMode = computed(
  () => isVisibleTunMode.value && !activeBackend.value?.disableTunMode,
)

const hasVisibleActions = computed(() =>
  backendActions.value.some((action) => isSettingVisible(action.key)),
)

// 派生的「有没有东西可显示」必须和条目自身的门控一致,否则会渲染出空容器。
const showDnsQuery = computed(() => isVisibleDnsQuery.value && can('dnsQuery'))

const hasVisibleItems = computed(() => {
  return (
    isVisibleBackendSwitch.value ||
    hasVisibleSettings.value ||
    hasVisibleActions.value ||
    showDnsQuery.value
  )
})

const hasVisibleSettings = computed(() => {
  return (
    can('configPatch') &&
    !!configs.value &&
    (isVisiblePorts.value ||
      (configs.value.tun && canShowTunMode.value) ||
      isVisibleAllowLan.value ||
      (!activeBackend.value?.disableUpgradeCore &&
        (isVisibleCheckUpgrade.value || (checkUpgradeCore.value && isVisibleAutoUpgrade.value))))
  )
})

const handlerCheckUpgradeCoreChange = () => {
  if (!checkUpgradeCore.value) {
    autoUpgradeCore.value = false
    isCoreUpdateAvailable.value = false
  }
}

const hanlderTunModeChange = async () => {
  try {
    await updateConfigs({ tun: { enable: configs.value?.tun.enable } })
  } catch (e) {
    notifyRequestError(e)
  }
}
const handlerAllowLanChange = async () => {
  try {
    await updateConfigs({ ['allow-lan']: configs.value?.['allow-lan'] })
  } catch (e) {
    notifyRequestError(e)
  }
}
</script>
