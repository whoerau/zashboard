import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { createGenerationGuard } from '../src/helper/generationGuard.ts'
import { resolveGeoIPDatabaseURL } from '../src/helper/geoipDatabase.ts'
import { parseLanRulesManifest } from '../src/helper/lanRulesManifest.ts'

test('routes notification messages through the text-only renderer', () => {
  const source = readFileSync(new URL('../src/helper/notification.ts', import.meta.url), 'utf8')

  assert.match(source, /contentDiv\.textContent = t\(content, params\)/)
  assert.doesNotMatch(source, /contentDiv\.innerHTML/)
})

test('keeps a successful backend probe when update checks fail', () => {
  const source = readFileSync(new URL('../src/assembly/version.ts', import.meta.url), 'utf8')

  assert.match(source, /fetchBackendUpdateAvailableAPI\(\)\.catch\([\s\S]*?return false\n\s*}\)/)
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
