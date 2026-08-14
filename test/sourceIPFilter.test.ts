import assert from 'node:assert/strict'
import test from 'node:test'
import { buildSourceIPOptions, createSourceIPFilterMatcher } from '../src/helper/sourceIPFilter.ts'

test('groups every resolved source address under one LAN device', () => {
  const options = buildSourceIPOptions({
    sourceIPs: ['192.168.50.94', '::ffff:192.168.50.94', '2001:db8::94', '198.18.0.1'],
    sourceIPLabels: [
      { id: '1', key: '192.168.50.94', label: 'manual-oneplus8' },
      { id: '2', key: '192.168.50.250', label: 'named-extra' },
    ],
    resolveLanDevice: (ip) =>
      ['192.168.50.94', '::ffff:192.168.50.94', '2001:db8::94'].includes(ip)
        ? 'oneplus8'
        : undefined,
  })

  assert.deepEqual(options, [
    {
      label: 'oneplus8',
      value: ['192.168.50.94', '::ffff:192.168.50.94', '2001:db8::94'],
    },
    { label: '198.18.0.1', value: ['198.18.0.1'] },
    { label: 'named-extra', value: ['192.168.50.250'] },
  ])
})

test('matches IPv4 and IPv4-mapped source addresses as one filter identity', () => {
  const matchesSourceIP = createSourceIPFilterMatcher(['192.168.50.94'])

  assert.equal(matchesSourceIP('::ffff:192.168.50.94'), true)
  assert.equal(matchesSourceIP('192.168.50.95'), false)
})

test('skips scoped source IP labels for other backends', () => {
  const options = buildSourceIPOptions({
    sourceIPs: [],
    sourceIPLabels: [
      { id: '1', key: '192.168.50.250', label: 'current-backend', scope: ['active-backend'] },
      { id: '2', key: '192.168.50.251', label: 'other-backend', scope: ['other-backend'] },
    ],
    activeBackendID: 'active-backend',
  })

  assert.deepEqual(options, [{ label: 'current-backend', value: ['192.168.50.250'] }])
})
