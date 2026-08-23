import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createLanDeviceResolver,
  getLanDeviceDisplayName,
  getLanDeviceFromScopedProxyName,
  getLanDeviceName,
  getLanDeviceScopedProxyName,
  getValidLanDevice,
  isProxyGroupInLanDeviceScope,
  labelLanDeviceIPsInLog,
  LAN_DEVICE_STORAGE_KEYS,
  resolveRulesDeviceSelection,
  sortLanDeviceNames,
} from '../src/helper/lanDevice.ts'
import { getRuleDisplayNumber } from '../src/helper/ruleView.ts'

test('resolves LAN devices from source CIDR sub-rules', () => {
  const rules = [
    { proxy: 'lan/oneplus8', payload: '(SRC-IP-CIDR,192.168.50.94/32)' },
    { proxy: 'lan/solana', payload: '(SRC-IP-CIDR,192.168.50.206/32)' },
    { proxy: 'DIRECT', payload: 'LAN' },
    { proxy: 'lan/broken', payload: '(SRC-IP-CIDR,invalid)' },
  ]

  assert.equal(getLanDeviceName('192.168.50.94', rules), 'oneplus8')
  assert.equal(getLanDeviceName('192.168.50.206', rules), 'solana')
  assert.equal(getLanDeviceName('192.168.50.1', rules), undefined)
  assert.equal(getLanDeviceName('Inner', rules), undefined)
})

test('resolves nested AND/OR source CIDR identity rules', () => {
  const rules = [
    {
      proxy: 'lan/phone',
      payload: '(OR,(SRC-IP-CIDR,192.168.50.94/32),(SRC-IP-CIDR6,2001:db8::5/128))',
    },
  ]

  assert.equal(getLanDeviceName('192.168.50.94', rules), 'phone')
  assert.equal(getLanDeviceName('2001:db8::5', rules), 'phone')
  assert.equal(getLanDeviceName('192.168.50.1', rules), undefined)
})

test('resolves raw source CIDRs, no-resolve, and IPv4-mapped sources', () => {
  const rules = [
    {
      type: 'SRC-IP-CIDR',
      proxy: 'lan/phone',
      payload: '192.168.50.94/32,no-resolve',
    },
    {
      type: 'SRC-IP-CIDR6',
      proxy: 'lan/tablet',
      payload: '2001:db8::5/128,no-resolve',
    },
  ]

  assert.equal(getLanDeviceName('192.168.50.94', rules), 'phone')
  assert.equal(getLanDeviceName('::ffff:192.168.50.94', rules), 'phone')
  assert.equal(getLanDeviceName('2001:db8::5', rules), 'tablet')
})

test('adds the LAN device name to known source IPs', () => {
  const rules = [{ proxy: 'lan/oneplus8', payload: '(SRC-IP-CIDR,192.168.50.94/32)' }]

  assert.equal(
    getLanDeviceDisplayName('192.168.50.94', rules, (ip) => ip),
    '192.168.50.94 (oneplus8)',
  )
  assert.equal(
    getLanDeviceDisplayName('192.168.50.1', rules, () => 'Router'),
    'Router',
  )
})

test('restores only valid LAN device scopes', () => {
  assert.equal(getValidLanDevice('iphone14pm', ['iphone14pm', 'solana']), 'iphone14pm')
  assert.equal(getValidLanDevice('removed', ['iphone14pm', 'solana']), '')
  assert.equal(isProxyGroupInLanDeviceScope('lan/iphone14pm/GLOBAL', 'iphone14pm'), true)
  assert.equal(isProxyGroupInLanDeviceScope('lan/iphone14/GLOBAL', 'iphone14pm'), false)
  assert.equal(isProxyGroupInLanDeviceScope('lan/iphone14pm/GLOBAL', 'iphone14'), false)
  assert.equal(isProxyGroupInLanDeviceScope('lan/w-nas/GLOBAL', 'w'), false)
})

test('keeps Proxies and Rules device persistence independent', () => {
  assert.notEqual(LAN_DEVICE_STORAGE_KEYS.proxies, LAN_DEVICE_STORAGE_KEYS.rules)
})

test('sorts reserved LAN device slots after named devices', () => {
  assert.deepEqual(
    sortLanDeviceNames(['slot02', 'switch', 'oneplus8', 'slot01', 'solana', 'w-nas']),
    ['oneplus8', 'solana', 'switch', 'w-nas', 'slot01', 'slot02'],
  )
})

test('formats scoped LAN proxy names only for the matching device', () => {
  assert.equal(getLanDeviceFromScopedProxyName('lan/iphone14pm/🔰 节点选择'), 'iphone14pm')
  assert.equal(
    getLanDeviceScopedProxyName('lan/iphone14pm/🔰 节点选择', 'iphone14pm'),
    '🔰 节点选择',
  )
  assert.equal(
    getLanDeviceScopedProxyName('lan/ipad-mini/🔰 节点选择', 'iphone14pm'),
    'lan/ipad-mini/🔰 节点选择',
  )
  assert.equal(
    getLanDeviceScopedProxyName('lan/iphone14pm/GLOBAL', 'iphone14'),
    'lan/iphone14pm/GLOBAL',
  )
  assert.match(getLanDeviceScopedProxyName('lan/iphone14pm/GLOBAL', 'iphone14pm'), /^GLOBAL$/)
})

test('preserves the Rules device while manifest state is unavailable', () => {
  assert.equal(resolveRulesDeviceSelection('iphone14pm'), 'iphone14pm')
})

test('clears the Rules device only after a valid manifest excludes it', () => {
  assert.equal(resolveRulesDeviceSelection('iphone14pm', ['iphone14pm']), 'iphone14pm')
  assert.equal(resolveRulesDeviceSelection('removed', ['iphone14pm']), '')
})

test('compiled LAN resolver does not rescan rules for repeated IP lookups', () => {
  let proxyReads = 0
  const rule = {
    get proxy() {
      proxyReads++
      return 'lan/oneplus8'
    },
    payload: '(SRC-IP-CIDR,192.168.50.94/32)',
  }

  const resolve = createLanDeviceResolver([rule])
  const readsAfterCompile = proxyReads

  assert.equal(resolve('192.168.50.94'), 'oneplus8')
  assert.equal(resolve('192.168.50.94'), 'oneplus8')
  assert.equal(proxyReads, readsAfterCompile)
})

test('adds LAN device names to IPv4 and bracketed IPv6 log endpoints', () => {
  const resolve = createLanDeviceResolver([
    { proxy: 'lan/phone', payload: '(SRC-IP-CIDR,192.168.50.94/32)' },
    { proxy: 'lan/tablet', payload: '(SRC-IP-CIDR6,2001:db8::5/128)' },
  ])

  assert.equal(
    labelLanDeviceIPsInLog(
      'accepted 192.168.50.94:54321 -> [2001:db8::5]:443, ignored 192.168.50.1:53',
      resolve,
    ),
    'accepted 192.168.50.94 (phone):54321 -> [2001:db8::5] (tablet):443, ignored 192.168.50.1:53',
  )
})

test('labels an IPv4-mapped log endpoint only once', () => {
  const resolve = createLanDeviceResolver([
    { proxy: 'lan/phone', payload: '(SRC-IP-CIDR,192.168.50.94/32)' },
  ])

  assert.equal(
    labelLanDeviceIPsInLog('[::ffff:192.168.50.94]:54321 connected', resolve),
    '[::ffff:192.168.50.94] (phone):54321 connected',
  )
})

test('keeps source positions for ordinary rules and local positions for scoped rules', () => {
  const first = { index: 0 }
  const second = { index: 1 }
  const third = { index: 2 }

  assert.equal(getRuleDisplayNumber(third, 0, [first, second, third]), 3)
  assert.equal(getRuleDisplayNumber({ ...third, readOnly: true }, 0, [first, second, third]), 1)
})
