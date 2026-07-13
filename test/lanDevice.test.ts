import assert from 'node:assert/strict'
import test from 'node:test'
import {
  createLanDeviceResolver,
  getLanDeviceDisplayName,
  getLanDeviceFilter,
  getLanDeviceFromScopedProxyName,
  getLanDeviceName,
  getLanDeviceScopedProxyName,
  getValidLanDevice,
  isLanDeviceFilter,
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
  assert.equal(getLanDeviceFilter('iphone14pm'), '^lan/iphone14pm/')
  assert.equal(getLanDeviceFilter('pixel.9'), '^lan/pixel\\.9/')
  assert.equal(isLanDeviceFilter('^lan/iphone14pm/', 'iphone14pm'), true)
  assert.equal(isLanDeviceFilter('^lan/pixel.9/', 'pixel.9'), false)
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

test('keeps source positions for ordinary rules and local positions for scoped rules', () => {
  const first = { index: 0 }
  const second = { index: 1 }
  const third = { index: 2 }

  assert.equal(getRuleDisplayNumber(third, 0, [first, second, third]), 3)
  assert.equal(getRuleDisplayNumber({ ...third, readOnly: true }, 0, [first, second, third]), 1)
})
