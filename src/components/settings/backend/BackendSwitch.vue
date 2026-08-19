<!--
  纯粹的后端切换器。以前它是「切换 + 编辑 + 新增」三合一,而且那个齿轮图标按钮
  实际做的是「清空 activeUuid 再跳 setup 页」—— 想加一个后端得先把自己登出。
  现在增删改统一进 BackendManager,这里只管选一个后端。

  用弹出列表而不是原生 select:每一项要带上「此刻通不通、多少延迟」,
  切过去之前就知道结果,而不是切完看着空页面才发现。

  列表 teleport 到 #app-content 并按触发器的位置定位,而不是用 CSS 下拉:
  两个挂载点(侧边栏底部、设置面板)都在滚动容器里,绝对定位的菜单会被裁掉 ——
  原生 select 不会,是因为它画在浏览器的顶层。这里靠 teleport 补回这一点,
  空间不够时向上翻。
-->
<template>
  <div :class="compact ? 'flex-none' : 'w-full'">
    <!-- 折叠的侧边栏只剩一列图标,状态点叠在图标角上 —— 不展开也能看出当前后端活没活。 -->
    <button
      v-if="compact"
      ref="triggerRef"
      class="btn btn-circle btn-sm relative"
      :aria-label="$t('backend')"
      @click="toggle"
      @mouseenter="showLabelTip"
    >
      <ServerIcon class="h-5 w-5" />
      <span
        class="ring-base-100 absolute right-0.5 bottom-0.5 h-2 w-2 rounded-full ring-2"
        :class="compactDotClass"
      ></span>
    </button>

    <button
      v-else
      ref="triggerRef"
      class="btn btn-sm w-full flex-nowrap justify-between font-normal"
      @click="toggle"
    >
      <template v-if="activeBackend">
        <BackendStatusDot
          :status="activeState.status"
          :show-latency="false"
        />
        <span class="min-w-0 flex-1 truncate text-left">
          {{ getLabelFromBackend(activeBackend) }}
        </span>
      </template>
      <span
        v-else
        class="min-w-0 flex-1 truncate text-left"
      >
        {{ $t('noBackendYet') }}
      </span>
      <ChevronUpDownIcon class="h-4 w-4 flex-none opacity-50" />
    </button>

    <Teleport
      to="#app-content"
      v-if="isReady"
    >
      <Transition name="backend-switch">
        <div
          v-if="isOpen"
          ref="panelRef"
          class="border-base-border bg-base-100 fixed z-[100000] flex flex-col gap-1 overflow-hidden rounded-lg border p-1 shadow-lg"
          :style="panelStyle"
        >
          <div
            v-if="backendList.length"
            class="flex min-h-0 flex-col gap-1 overflow-y-auto"
          >
            <button
              v-for="backend in backendList"
              :key="backend.uuid"
              class="flex items-center gap-2 rounded-md px-2 py-1.5 text-left transition-colors"
              :class="backend.uuid === activeUuid ? 'bg-primary/10' : 'hover:bg-base-200'"
              @click="switchTo(backend.uuid)"
            >
              <BackendStatusDot
                :status="stateOf(backend.uuid).status"
                :show-latency="false"
              />
              <span class="min-w-0 flex-1 truncate text-sm">
                {{ getLabelFromBackend(backend) }}
              </span>
              <span
                v-if="stateOf(backend.uuid).status === 'online'"
                class="text-base-content/50 flex-none text-xs tabular-nums"
              >
                {{ stateOf(backend.uuid).latency }} ms
              </span>
            </button>
          </div>

          <div
            v-if="backendList.length"
            class="bg-base-content/10 mx-1 h-px flex-none"
          ></div>

          <button
            class="hover:bg-base-200 flex flex-none items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors"
            @click="manage"
          >
            <Cog6ToothIcon class="h-4 w-4 flex-none opacity-60" />
            {{ backendList.length ? $t('manageBackends') : $t('addBackend') }}
          </button>
        </div>
      </Transition>
    </Teleport>
  </div>
</template>

<script setup lang="ts">
import BackendStatusDot from '@/components/common/BackendStatusDot.vue'
import { useBackendListProbe } from '@/composables/backendListProbe'
import { useTooltip } from '@/helper/tooltip'
import { getLabelFromBackend } from '@/helper/utils'
import {
  activeBackend,
  activeUuid,
  backendList,
  openBackendManager,
  setActiveBackend,
} from '@/store/setup'
import { ChevronUpDownIcon, Cog6ToothIcon, ServerIcon } from '@heroicons/vue/24/outline'
import { computed, onBeforeUnmount, onMounted, ref, type CSSProperties } from 'vue'

const GAP = 4
const MIN_WIDTH = 224
const VIEWPORT_PADDING = 8

withDefaults(defineProps<{ compact?: boolean }>(), { compact: false })

const triggerRef = ref<HTMLButtonElement>()
const panelRef = ref<HTMLDivElement>()
const isOpen = ref(false)
const panelStyle = ref<CSSProperties>({})

// Teleport 的目标是挂载本组件的 #app-content,首帧还不在 DOM 里。
const isReady = ref(false)

// 只在展开时探测,收起就停 —— 侧边栏常驻,不该一直在后台打请求。
const { stateOf } = useBackendListProbe(isOpen)

// 当前后端的状态不依赖展开:stateOf 会优先用会话自己的探测结果(backendProbe),
// 所以折叠状态下那个点也一直是准的。
const activeState = computed(() => stateOf.value(activeUuid.value || ''))

const compactDotClass = computed(() => {
  if (!activeBackend.value) return 'bg-base-content/25'

  switch (activeState.value.status) {
    case 'online':
      return 'bg-success'
    case 'offline':
      return 'bg-error'
    case 'checking':
      return 'bg-warning animate-pulse'
    default:
      return 'bg-base-content/25'
  }
})

const { showTip } = useTooltip()

const showLabelTip = (event: MouseEvent) => {
  if (!activeBackend.value) return
  showTip(event, getLabelFromBackend(activeBackend.value), { placement: 'right' })
}

const updatePosition = () => {
  const trigger = triggerRef.value

  if (!trigger) return

  const rect = trigger.getBoundingClientRect()
  const width = Math.max(rect.width, MIN_WIDTH)
  const left = Math.min(
    Math.max(rect.left, VIEWPORT_PADDING),
    window.innerWidth - width - VIEWPORT_PADDING,
  )
  const spaceBelow = window.innerHeight - rect.bottom - GAP - VIEWPORT_PADDING
  const spaceAbove = rect.top - GAP - VIEWPORT_PADDING

  // 侧边栏里的切换器贴着底边,向下几乎没有空间 —— 哪边宽敞往哪边开。
  const dropUp = spaceBelow < 160 && spaceAbove > spaceBelow

  panelStyle.value = {
    left: `${left}px`,
    width: `${width}px`,
    maxHeight: `${Math.max(dropUp ? spaceAbove : spaceBelow, 120)}px`,
    ...(dropUp
      ? { bottom: `${window.innerHeight - rect.top + GAP}px` }
      : { top: `${rect.bottom + GAP}px` }),
  }
}

const handlePointerDown = (event: PointerEvent) => {
  const target = event.target as Node | null

  if (!target) return
  if (triggerRef.value?.contains(target) || panelRef.value?.contains(target)) return

  close()
}

const handleKeydown = (event: KeyboardEvent) => {
  if (event.key === 'Escape') close()
}

// 滚动的是外层容器而不是面板自己,所以用捕获阶段听,跟着触发器走。
const listen = (add: boolean) => {
  const fn = add ? window.addEventListener : window.removeEventListener

  fn('scroll', updatePosition, true)
  fn('resize', updatePosition)
  fn('pointerdown', handlePointerDown as EventListener, true)
  fn('keydown', handleKeydown as EventListener)
}

function close() {
  if (!isOpen.value) return

  isOpen.value = false
  listen(false)
}

const open = () => {
  updatePosition()
  isOpen.value = true
  listen(true)
}

const toggle = () => (isOpen.value ? close() : open())

const switchTo = (uuid: string) => {
  setActiveBackend(uuid)
  close()
}

const manage = () => {
  openBackendManager(backendList.value.length ? { mode: 'list' } : { mode: 'create' })
  close()
}

onMounted(() => {
  isReady.value = true
})

onBeforeUnmount(() => listen(false))
</script>

<style scoped>
.backend-switch-enter-active,
.backend-switch-leave-active {
  transition:
    opacity 0.15s ease,
    transform 0.15s cubic-bezier(0.32, 0.72, 0, 1);
}

.backend-switch-enter-from,
.backend-switch-leave-to {
  opacity: 0;
  transform: scale(0.97);
}

@media (prefers-reduced-motion: reduce) {
  .backend-switch-enter-active,
  .backend-switch-leave-active {
    transition: opacity 0.15s ease;
  }

  .backend-switch-enter-from,
  .backend-switch-leave-to {
    transform: none;
  }
}
</style>
