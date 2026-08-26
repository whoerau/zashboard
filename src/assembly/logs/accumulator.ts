// 组装层 · 日志累加器。
// 后端一次产出一条 Log,这里统一做与后端无关的加工:source-ip 标签替换、seq 编号、时间、暂停门控、保留上限与节流落表,
// 维护完整的 logs ref。store 直接引用该 ref,不再参与组装。
import { lanDeviceResolver } from '@/assembly/rules'
import { labelLanDeviceIPsInLog } from '@/helper/lanDevice'
import { logRetentionLimit, sourceIPLabelList } from '@/store/settings'
import { activeBackend } from '@/store/setup'
import type { Log, LogWithSeq } from '@/types'
import dayjs from 'dayjs'
import { throttle } from 'lodash'
import { watch, type Ref } from 'vue'

export interface LogsAccumulator {
  // 后端产出的一批原始日志(已是 { type, payload } 形态)投递入表。
  push: (batch: Log[]) => void
  dispose: () => void
}

export const createLogsAccumulator = (
  logs: Ref<LogWithSeq[]>,
  isPaused: () => boolean,
): LogsAccumulator => {
  let idx = 1
  let logsTemp: LogWithSeq[] = []
  // Preserve source text because rendered IP labels cannot be safely reversed.
  // 保留原始文本，因为渲染后的 IP 标签无法安全还原。
  const rawPayloads = new Map<number, string>()

  const flush = throttle(() => {
    const retainedLogs = logsTemp.concat(logs.value).slice(0, logRetentionLimit.value)
    logsTemp = []
    logs.value = retainedLogs

    const retainedSequences = new Set(retainedLogs.map((log) => log.seq))
    for (const sequence of rawPayloads.keys()) {
      if (!retainedSequences.has(sequence)) rawPayloads.delete(sequence)
    }
  }, 500)

  // source-ip 标签替换规则,随 sourceIPLabelList / 当前后端变化重建。
  const ipSourceMatchs: [RegExp, string][] = []
  const restructMatchs = () => {
    ipSourceMatchs.length = 0
    for (const { key, label, scope } of sourceIPLabelList.value) {
      if (scope && !scope.includes(activeBackend.value?.uuid as string)) continue
      if (key.startsWith('/')) continue

      if (key.includes(':')) {
        const regex = new RegExp(`${key}]:`, 'ig')
        ipSourceMatchs.push([regex, `${key}] (${label}) :`])
      } else {
        const regex = new RegExp(`${key}:`, 'ig')
        ipSourceMatchs.push([regex, `${key} (${label}) :`])
      }
    }
  }

  const stopWatch = watch(
    () => [sourceIPLabelList.value, activeBackend.value],
    () => restructMatchs(),
    { immediate: true, deep: true },
  )

  const labelPayload = (payload: string) => {
    let labeled = labelLanDeviceIPsInLog(payload, lanDeviceResolver.value)
    for (const [regex, label] of ipSourceMatchs) {
      labeled = labeled.replace(regex, label)
    }
    return labeled
  }

  const relabelStoredLogs = () => {
    if (logsTemp.length) {
      logsTemp = logsTemp.map((log) => ({
        ...log,
        payload: labelPayload(rawPayloads.get(log.seq) ?? log.payload),
      }))
    }
    if (logs.value.length) {
      logs.value = logs.value.map((log) => ({
        ...log,
        payload: labelPayload(rawPayloads.get(log.seq) ?? log.payload),
      }))
    }
  }

  const stopResolverWatch = watch(lanDeviceResolver, relabelStoredLogs)

  const push = (batch: Log[]) => {
    for (const data of batch) {
      // 暂停时丢弃该条但仍推进 seq,与既有行为一致。
      if (isPaused()) {
        idx++
        continue
      }

      const sequence = idx++
      rawPayloads.set(sequence, data.payload)
      logsTemp.unshift({
        ...data,
        payload: labelPayload(data.payload),
        time: dayjs().format('HH:mm:ss'),
        seq: sequence,
      })
    }

    flush()
  }

  return {
    push,
    dispose: () => {
      stopWatch()
      stopResolverWatch()
      flush.cancel()
    },
  }
}
