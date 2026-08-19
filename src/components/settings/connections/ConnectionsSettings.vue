<template>
  <!-- connections -->
  <div
    v-if="hasVisibleItems"
    class="flex flex-col gap-3 text-sm"
  >
    <div class="settings-grid">
      <SettingItem :setting-key="k.connectionStyle">
        <div class="setting-item-label">
          {{ $t('connectionStyle') }}
        </div>
        <SelectInput
          class="select select-sm min-w-24"
          v-model="connectionDisplayStyle"
          :options="[
            { value: CONNECTION_DISPLAY_STYLE.AUTO, label: $t('auto') },
            { value: CONNECTION_DISPLAY_STYLE.CARD, label: $t('card') },
            { value: CONNECTION_DISPLAY_STYLE.TABLE, label: $t('table') },
          ]"
        />
      </SettingItem>
      <SettingItem :setting-key="k.proxyChainDirection">
        <div class="setting-item-label">
          {{ $t('proxyChainDirection') }}
        </div>
        <SelectInput
          class="select select-sm w-24"
          v-model="proxyChainDirection"
          :options="
            Object.values(PROXY_CHAIN_DIRECTION).map((value) => ({
              value,
              label: $t(value),
            }))
          "
        />
      </SettingItem>
      <SettingItem
        :setting-key="k.tableWidthMode"
        :when="!isConnectionCard"
      >
        <div class="setting-item-label">
          {{ $t('tableWidthMode') }}
        </div>
        <SelectInput
          class="select select-sm min-w-24"
          v-model="tableWidthMode"
          :options="Object.values(TABLE_WIDTH_MODE).map((value) => ({ value, label: $t(value) }))"
        />
      </SettingItem>
      <SettingItem
        :setting-key="k.tableSize"
        :when="!isConnectionCard"
      >
        <div class="setting-item-label">
          {{ $t('tableSize') }}
        </div>
        <SelectInput
          class="select select-sm min-w-24"
          v-model="tableSize"
          :options="Object.values(TABLE_SIZE).map((value) => ({ value, label: $t(value) }))"
        />
      </SettingItem>
      <SettingItem
        :setting-key="k.resolveClientHostname"
        :when="can('dnsQuery')"
      >
        <div class="setting-item-label">
          {{ $t('resolveClientHostname') }}
        </div>
        <input
          type="checkbox"
          v-model="resolveClientHostname"
          class="toggle"
        />
      </SettingItem>
      <SourceIPLabels :setting-key="k.sourceIPLabels" />
    </div>
  </div>
</template>

<script setup lang="ts">
import { can } from '@/assembly/backend'
import SelectInput from '@/components/common/SelectInput.vue'
import SourceIPLabels from '@/components/settings/connections/SourceIPLabels.vue'
import SettingItem from '@/components/settings/SettingItem.vue'
import { useHasAnyVisibleSetting } from '@/composables/settings'
import { CONNECTIONS_ITEM_KEYS, getItemKeysByCategory } from '@/config/settingsItems'
import {
  CONNECTION_DISPLAY_STYLE,
  PROXY_CHAIN_DIRECTION,
  SETTINGS_MENU_KEY,
  TABLE_SIZE,
  TABLE_WIDTH_MODE,
} from '@/constant'
import {
  connectionDisplayStyle,
  isConnectionCard,
  proxyChainDirection,
  resolveClientHostname,
  tableSize,
  tableWidthMode,
} from '@/store/settings'

const k = CONNECTIONS_ITEM_KEYS

const hasVisibleItems = useHasAnyVisibleSetting(
  getItemKeysByCategory(SETTINGS_MENU_KEY.connections),
)
</script>
