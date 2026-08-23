import assert from 'node:assert/strict'
import test from 'node:test'
import {
  buildConnectionHistoryView,
  filterSourceIPHistoryEntries,
  filterVisibleSourceEntries,
  shouldRenderTopologySource,
} from '../src/helper/topology.ts'

test('filters Inner from topology source nodes only', () => {
  assert.equal(shouldRenderTopologySource(''), false)
  assert.equal(shouldRenderTopologySource('Inner'), false)
  assert.equal(shouldRenderTopologySource('192.168.50.94'), true)
  assert.equal(shouldRenderTopologySource('198.18.0.1'), true)
})

test('filters Inner from source aggregation entries', () => {
  assert.deepEqual(
    filterVisibleSourceEntries([
      { key: '', count: 1 },
      { key: 'Inner', count: 2 },
      { key: '192.168.50.94', count: 3 },
    ]),
    [{ key: '192.168.50.94', count: 3 }],
  )
})

test('keeps hidden Inner traffic in overview totals', () => {
  const result = buildConnectionHistoryView(
    [
      { key: 'Inner', download: 10, upload: 20, count: 1 },
      { key: '192.168.50.94', download: 30, upload: 40, count: 2 },
    ],
    true,
  )

  assert.deepEqual(result.rows, [{ key: '192.168.50.94', download: 30, upload: 40, count: 2 }])
  assert.deepEqual(result.totals, { download: 40, upload: 60, count: 3 })
})

test('filters historical source rows with the current dual-stack LAN device selection', () => {
  const entries = [
    { key: '192.168.50.94', count: 1 },
    { key: '2001:db8::94', count: 2 },
    { key: '192.168.50.95', count: 3 },
  ]
  const resolveDevice = (ip: string) =>
    ip === '192.168.50.94' || ip === '2001:db8::94' ? 'phone' : undefined

  assert.deepEqual(
    filterSourceIPHistoryEntries(entries, ['192.168.50.94'], resolveDevice),
    entries.slice(0, 2),
  )
  assert.deepEqual(filterSourceIPHistoryEntries(entries, null, resolveDevice), entries)
})
