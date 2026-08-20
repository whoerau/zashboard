<template>
  <SelectInput
    class="select select-sm"
    v-model="sourceIPFilter"
    :options="[{ value: null, label: $t('all') }, ...sourceIPOpts]"
  />
</template>

<script setup lang="ts">
import { lanDeviceResolver } from '@/assembly/rules'
import SelectInput from '@/components/common/SelectInput.vue'
import { getConnectionSourceIP } from '@/helper'
import { reverseDNSRevision } from '@/helper/reverseDns'
import { buildSourceIPOptions } from '@/helper/sourceIPFilter'
import { getIPLabelFromMap } from '@/helper/sourceip'
import { connections, sourceIPFilter } from '@/store/connections'
import { resolveClientHostname, sourceIPLabelList } from '@/store/settings'
import { activeBackend, activeUuid } from '@/store/setup'
import * as ipaddr from 'ipaddr.js'
import { uniq } from 'lodash'
import { computed, ref, watch } from 'vue'

const sourceIPs = computed(() => {
  return uniq(connections.value.map(getConnectionSourceIP)).sort((a, b) => {
    if (!ipaddr.isValid(a)) return -1
    if (!ipaddr.isValid(b)) return 1

    const preIP = ipaddr.parse(a)
    const nextIP = ipaddr.parse(b)

    const isPreIPv4 = preIP.kind() === 'ipv4'
    const isNextIPv4 = nextIP.kind() === 'ipv4'

    if (!isPreIPv4 && isNextIPv4) return 1
    if (!isNextIPv4 && isPreIPv4) return -1

    const preIPBytes = preIP.toByteArray()
    const nextIPBytes = nextIP.toByteArray()

    for (let i = 0; i < preIPBytes.length; i++) {
      if (preIPBytes[i] !== nextIPBytes[i]) {
        return preIPBytes[i] - nextIPBytes[i]
      }
    }
    return 0
  })
})
const sourceIPOpts = ref<{ label: string; value: string[] }[]>([])
const sourceIPsKey = computed(() => sourceIPs.value.join('\u0000'))
const manualSourceIPLabels = computed(() =>
  sourceIPLabelList.value.map(({ key, label, scope }) => ({ key, label, scope })),
)

// do not use computed here for firefox
watch(
  [
    sourceIPsKey,
    lanDeviceResolver,
    manualSourceIPLabels,
    activeBackend,
    reverseDNSRevision,
    resolveClientHostname,
    activeUuid,
  ],
  () => {
    const options = buildSourceIPOptions({
      sourceIPs: sourceIPs.value,
      sourceIPLabels: manualSourceIPLabels.value,
      activeBackendID: activeBackend.value?.uuid,
      resolveLanDevice: lanDeviceResolver.value,
      resolveSourceIPLabel: getIPLabelFromMap,
    })

    if (sourceIPFilter.value !== null) {
      const currentIP = sourceIPFilter.value[0]
      const currentDevice = lanDeviceResolver.value(currentIP)
      const currentLabel = currentDevice ?? getIPLabelFromMap(currentIP)
      const current = options.find((opt) => opt.label === currentLabel)

      if (!current) {
        options.unshift({
          label: currentLabel,
          value: sourceIPFilter.value,
        })
      } else {
        // Share the option array so SelectInput's Object.is selection stays in sync.
        // 与 option 共用同一数组引用，避免 SelectInput 的 Object.is 在重建后丢选中态。
        sourceIPFilter.value = current.value
      }
    }

    sourceIPOpts.value = options
  },
  {
    immediate: true,
  },
)
</script>
