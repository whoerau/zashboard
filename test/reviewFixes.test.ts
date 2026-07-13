import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { createGenerationGuard } from '../src/helper/generationGuard.ts'
import { resolveGeoIPDatabaseURL } from '../src/helper/geoipDatabase.ts'
import { getHistoryTimeWindow } from '../src/helper/historyWindow.ts'
import { parseLanRulesManifest } from '../src/helper/lanRulesManifest.ts'
import { setTextContent } from '../src/helper/textContent.ts'

test('renders untrusted notification content as text', () => {
  const element = { innerHTML: 'unchanged', textContent: '' }
  const attack = '<img src=x onerror="globalThis.pwned=true">'

  setTextContent(element, attack)

  assert.equal(element.textContent, attack)
  assert.equal(element.innerHTML, 'unchanged')
})

test('routes notification messages through the text-only renderer', () => {
  const source = readFileSync(new URL('../src/helper/notification.ts', import.meta.url), 'utf8')

  assert.match(source, /setTextContent\(contentDiv, t\(content, params\)\)/)
  assert.doesNotMatch(source, /contentDiv\.innerHTML/)
})

test('invalidates stale asynchronous generations', () => {
  const guard = createGenerationGuard()
  const first = guard.next()
  const second = guard.next()

  assert.equal(guard.isCurrent(first), false)
  assert.equal(guard.isCurrent(second), true)
  assert.equal(guard.current(), second)
})

test('accepts a deeply valid LAN rules manifest', () => {
  const manifest = {
    version: 1,
    devices: [
      {
        name: 'phone',
        source: '192.168.1.2',
        subRule: 'lan/phone',
        rules: [{ sourceIndex: 3, proxy: 'DIRECT' }],
      },
    ],
  }

  assert.deepEqual(parseLanRulesManifest(manifest), manifest)
})

test('rejects malformed LAN rules manifest devices and bindings', () => {
  const malformed = [
    { version: 1, devices: [{ name: 'phone', source: 'ip', subRule: 'lan/phone' }] },
    {
      version: 1,
      devices: [
        {
          name: 'phone',
          source: 'ip',
          subRule: 'lan/phone',
          rules: [{ sourceIndex: '3', proxy: 'DIRECT' }],
        },
      ],
    },
    {
      version: 1,
      devices: [
        {
          name: '',
          source: 'ip',
          subRule: 'lan/phone',
          rules: [{ sourceIndex: 3, proxy: 'DIRECT' }],
        },
      ],
    },
  ]

  for (const manifest of malformed) {
    assert.throws(() => parseLanRulesManifest(manifest), /invalid LAN rules manifest/)
  }
})

test('uses the built-in GeoIP database URL for empty settings', () => {
  assert.equal(
    resolveGeoIPDatabaseURL('', 'https://default.example/db.mmdb'),
    'https://default.example/db.mmdb',
  )
  assert.equal(
    resolveGeoIPDatabaseURL('   ', 'https://default.example/db.mmdb'),
    'https://default.example/db.mmdb',
  )
  assert.equal(
    resolveGeoIPDatabaseURL(' https://custom.example/db.mmdb ', 'fallback'),
    'https://custom.example/db.mmdb',
  )
})

test('keeps the latest history sample inside the chart window', () => {
  assert.deepEqual(getHistoryTimeWindow(10_000, 5), { min: 6_000, max: 10_000 })
})
