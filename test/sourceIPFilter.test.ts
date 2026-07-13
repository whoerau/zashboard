import assert from 'node:assert/strict'
import test from 'node:test'
import { buildSourceIPOptions } from '../src/helper/sourceIPFilter.ts'

test('includes exact source IP labels that are not current LAN devices', () => {
  const options = buildSourceIPOptions({
    sourceIPs: ['192.168.50.94', '198.18.0.1'],
    sourceIPLabels: [
      { id: '1', key: '192.168.50.94', label: 'manual-oneplus8' },
      { id: '2', key: '192.168.50.250', label: 'named-extra' },
    ],
    resolveLanDevice: (ip) => (ip === '192.168.50.94' ? 'oneplus8' : undefined),
  })

  assert.deepEqual(options, [
    { label: '192.168.50.94 (oneplus8)', value: ['192.168.50.94'] },
    { label: '198.18.0.1', value: ['198.18.0.1'] },
    { label: 'named-extra', value: ['192.168.50.250'] },
  ])
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
