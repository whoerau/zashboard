<template>
  <select
    class="select select-sm"
    v-model="sourceIPFilter"
  >
    <option :value="null">{{ $t('all') }}</option>
    <option
      v-for="opt in sourceIPOpts"
      :key="opt.value.join(',')"
      :value="opt.value"
    >
      {{ opt.label }}
    </option>
  </select>
</template>

<script setup lang="ts">
import { lanDeviceResolver } from '@/assembly/rules'
import { getConnectionSourceIP } from '@/helper'
import { buildSourceIPOptions } from '@/helper/sourceIPFilter'
import { getIPLabelFromMap } from '@/helper/sourceip'
import { sourceIPLabelList } from '@/store/settings'
import { activeBackend } from '@/store/setup'
import { connections, sourceIPFilter } from '@/store/connections'
import * as ipaddr from 'ipaddr.js'
import { isEqual, uniq } from 'lodash'
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
const manualSourceIPLabels = computed(() =>
  sourceIPLabelList.value.map(({ key, label, scope }) => ({ key, label, scope })),
)
// do not use computed here for firefox
watch(
  [sourceIPs, lanDeviceResolver, manualSourceIPLabels, activeBackend],
  ([value]) => {
    const options = buildSourceIPOptions({
      sourceIPs: value,
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
      } else if (!isEqual(current.value, sourceIPFilter.value)) {
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
