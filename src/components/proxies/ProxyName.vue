<template>
  <div class="flex shrink-0 items-center">
    <ProxyIcon
      v-if="icon"
      :icon="icon"
      :margin="iconMargin"
      :size="iconSize"
    />
    <HighlightText
      v-if="filter"
      :text="displayName"
      :filter="filter"
    />
    <template v-else>{{ displayName }}</template>
    <template v-if="dialerProxy"> ({{ dialerProxy }}) </template>
  </div>
</template>

<script setup lang="ts">
import HighlightText from '@/components/common/HighlightText.vue'
import { proxyMap } from '@/assembly/proxies'
import { getLanDeviceScopedProxyName } from '@/helper/lanDevice'
import { computed } from 'vue'
import ProxyIcon from './ProxyIcon.vue'

const props = withDefaults(
  defineProps<{
    name: string
    iconSize?: number
    iconMargin?: number
    filter?: string
    lanDevice?: string
  }>(),
  {
    iconSize: 16,
    iconMargin: 4,
    filter: '',
    lanDevice: '',
  },
)

const node = computed(() => proxyMap.value[props.name])
const displayName = computed(() => getLanDeviceScopedProxyName(props.name, props.lanDevice))
const icon = computed(() => {
  return node.value?.icon
})
const dialerProxy = computed(() => {
  return node.value?.['dialer-proxy']
})
</script>
