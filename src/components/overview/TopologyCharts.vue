<template>
  <div class="base-container p-4">
    <div class="flex items-center justify-between">
      <div class="text-base-content/60 text-xs font-semibold tracking-wider uppercase">
        {{ $t('connectionTopology') }}
      </div>
    </div>
    <div class="bg-base-200/30 relative mt-4 h-96 w-full overflow-hidden rounded-xl">
      <Teleport
        to="body"
        :disabled="!isFullScreen"
      >
        <div
          :class="
            isFullScreen
              ? [
                  'bg-base-100 custom-background fixed inset-0 z-[9999] h-screen w-screen bg-cover bg-center',
                  `blur-intensity-${blurIntensity} custom-background-${dashboardTransparent}`,
                ]
              : 'relative h-full w-full'
          "
          :style="isFullScreen ? backgroundImage : undefined"
          @mousemove.stop
          @touchmove.stop
        >
          <div
            class="relative"
            :class="isFullScreen ? 'bg-base-100' : 'h-full w-full'"
            :style="chartSurfaceStyle"
          >
            <div
              ref="chartRef"
              class="h-full w-full"
            />
            <div
              v-if="isEmpty"
              class="text-base-content/50 absolute inset-0 flex items-center justify-center"
            >
              {{ t('noData') }}
            </div>
          </div>
          <div
            class="right-1 bottom-1 flex flex-col gap-1"
            :class="
              isFullScreen ? 'fixed right-4 bottom-4 mb-[env(safe-area-inset-bottom)]' : 'absolute'
            "
          >
            <button
              class="btn btn-ghost btn-circle btn-sm"
              @click="isManuallyPaused = !isManuallyPaused"
            >
              <component
                :is="isManuallyPaused ? PlayCircleIcon : PauseCircleIcon"
                class="h-4 w-4"
              />
            </button>
            <button
              class="btn btn-ghost btn-circle btn-sm"
              @click="isFullScreen = !isFullScreen"
            >
              <component
                :is="isFullScreen ? ArrowsPointingInIcon : ArrowsPointingOutIcon"
                class="h-4 w-4"
              />
            </button>
          </div>
        </div>
      </Teleport>
    </div>
  </div>
</template>

<script setup lang="ts">
import { rules } from '@/assembly/rules'
import { escapeChartHtml } from '@/components/charts/chartTooltip'
import { useChartTheme, useEChart, type EChartOption } from '@/composables/useEChart'
import { getConnectionChains, getConnectionRule, getConnectionSourceIP } from '@/helper'
import { backgroundImage } from '@/helper/indexeddb'
import { createLanDeviceResolver, getLanDeviceDisplayName } from '@/helper/lanDevice'
import { getIPLabelFromMap } from '@/helper/sourceip'
import { shouldRenderTopologySource } from '@/helper/topology'
import { isMiddleScreen } from '@/helper/utils'
import { activeConnections } from '@/store/connections'
import { blurIntensity, dashboardTransparent } from '@/store/settings'
import {
  ArrowsPointingInIcon,
  ArrowsPointingOutIcon,
  PauseCircleIcon,
  PlayCircleIcon,
} from '@heroicons/vue/24/outline'
import { useWindowSize } from '@vueuse/core'
import type { CSSProperties } from 'vue'
import { computed, nextTick, ref, watch } from 'vue'
import { useI18n } from 'vue-i18n'
import { buildTopologyData } from './topology'

const { t } = useI18n()
const chartRef = ref<HTMLElement>()
const isFullScreen = ref(false)
const isManuallyPaused = ref(false)
const isTooltipVisible = ref(false)
const { width: windowWidth, height: windowHeight } = useWindowSize()
const { colors, fontFamily } = useChartTheme(chartRef)

const isPaused = computed(() => isManuallyPaused.value || isTooltipVisible.value)
const shouldRotate = computed(
  () => isFullScreen.value && isMiddleScreen.value && windowHeight.value > windowWidth.value,
)

const chartSurfaceStyle = computed<CSSProperties>(() => {
  if (!isFullScreen.value) return {}

  const style: CSSProperties = {
    backdropFilter: `blur(${blurIntensity.value}px)`,
    height: '100%',
    width: '100%',
  }

  if (!shouldRotate.value) return style

  return {
    ...style,
    position: 'absolute',
    top: '50%',
    left: '50%',
    width: '100vh',
    height: '100vw',
    marginTop: '-50vw',
    marginLeft: '-50vh',
    transform: 'rotate(90deg)',
  }
})

const resolveLanDevice = computed(() => createLanDeviceResolver(rules.value))
const topologyData = computed(() =>
  buildTopologyData(
    activeConnections.value.flatMap((connection) => {
      const source = getConnectionSourceIP(connection)
      if (!shouldRenderTopologySource(source)) return []

      // Preserve fork-only LAN labels while using the upstream topology builder.
      // 使用上游拓扑构建器时保留分支专有的局域网设备标签。
      return [
        {
          source: getLanDeviceDisplayName(source, resolveLanDevice.value, getIPLabelFromMap),
          rule: getConnectionRule(connection),
          chains: getConnectionChains(connection),
        },
      ]
    }),
    {
      sourceIPAddress: t('sourceIPAddress'),
      ruleMatch: t('ruleMatch'),
      proxyChainEntry: t('proxyChainEntry'),
      proxyChainExit: t('proxyChainExit'),
      unknown: t('unknown'),
    },
  ),
)
const isEmpty = computed(() => topologyData.value.nodes.length === 0)

const options = computed<EChartOption>(() => ({
  backgroundColor: 'transparent',
  textStyle: {
    fontFamily: fontFamily.value || 'inherit',
    color: colors.baseContent,
  },
  tooltip: {
    trigger: 'item',
    triggerOn: 'mousemove',
    backgroundColor: colors.base70,
    borderColor: colors.baseContent30,
    textStyle: {
      color: colors.baseContent,
    },
    formatter: (params: unknown) => {
      const { dataType, data } = params as {
        dataType: 'node' | 'edge'
        data: {
          name: string
          nodeType?: string
          source: number
          target: number
          value: number
          originalValue?: number
        }
      }

      if (dataType === 'node') {
        return `${escapeChartHtml(data.name)}<br/>${escapeChartHtml(t('nodeType'))}: ${escapeChartHtml(
          data.nodeType || t('unknown'),
        )}`
      }

      if (dataType === 'edge') {
        const sourceNode = topologyData.value.nodes.find((node) => node.id === data.source)
        const targetNode = topologyData.value.nodes.find((node) => node.id === data.target)
        const count = data.originalValue ?? data.value

        if (sourceNode && targetNode) {
          return `${escapeChartHtml(sourceNode.name)} → ${escapeChartHtml(
            targetNode.name,
          )}<br/>${escapeChartHtml(t('connectionCount'))}: ${escapeChartHtml(count)}`
        }

        return `${escapeChartHtml(t('connectionCount'))}: ${escapeChartHtml(count)}`
      }

      return ''
    },
  },
  series: [
    {
      id: 'sankey',
      type: 'sankey',
      layout: 'none',
      data: topologyData.value.nodes,
      links: topologyData.value.links,
      emphasis: {
        focus: 'trajectory',
      },
      lineStyle: {
        color: 'gradient',
        curveness: 0.5,
      },
      itemStyle: {
        borderWidth: 0,
      },
      label: {
        color: colors.baseContent,
        fontSize: isMiddleScreen.value ? 10 : 12,
        formatter: (params: { name: string }) => {
          const maxLength = isFullScreen.value ? 45 : isMiddleScreen.value ? 20 : 30
          return params.name.length > maxLength
            ? `${params.name.substring(0, maxLength)}...`
            : params.name
        },
      },
      nodeGap: 4,
      nodeWidth: 15,
      nodeAlign: 'left',
      animation: true,
      animationDuration: 1000,
      animationEasing: 'cubicOut',
      animationDelay: (index: number) => index * 50,
    },
  ],
}))

const { resize } = useEChart(chartRef, options, {
  paused: isPaused,
  isEmpty,
  onInit: (chart) => {
    const showTooltip = () => {
      isTooltipVisible.value = true
    }
    const hideTooltip = () => {
      isTooltipVisible.value = false
    }

    chart.on('showTip', showTooltip)
    chart.on('hideTip', hideTooltip)

    return () => {
      chart.off('showTip', showTooltip)
      chart.off('hideTip', hideTooltip)
    }
  },
})

watch([isFullScreen, shouldRotate, windowWidth, windowHeight], () => {
  nextTick(resize)
})
</script>
