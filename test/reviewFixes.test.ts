import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'
import { getBackendScopedSnapshot } from '../src/helper/backendSnapshot.ts'
import { createGenerationGuard } from '../src/helper/generationGuard.ts'
import { resolveGeoIPDatabaseURL } from '../src/helper/geoipDatabase.ts'
import { createLanDeviceResolver } from '../src/helper/lanDevice.ts'
import {
  createLanRulesDigest,
  filterLanManifestSubRules,
  isLanRulesManifestForRules,
  isLanRulesManifestSameOrigin,
  loadLanRulesManifest,
  parseLanRulesManifest,
} from '../src/helper/lanRulesManifest.ts'
import { collectProxyLeafNames } from '../src/helper/proxyLatency.ts'
import { pickGitHubComparisonCacheData } from '../src/helper/uiUpdate.ts'

test('routes notification messages through the text-only renderer', () => {
  const source = readFileSync(new URL('../src/helper/notification.ts', import.meta.url), 'utf8')

  assert.match(source, /contentDiv\.textContent = t\(content, params\)/)
  assert.doesNotMatch(source, /contentDiv\.innerHTML/)
})

test('keeps a successful backend probe when update checks fail', () => {
  const source = readFileSync(new URL('../src/assembly/version.ts', import.meta.url), 'utf8')

  assert.match(source, /fetchBackendUpdateAvailableAPI\(\)\.catch\([\s\S]*?return false\n\s*}\)/)
})

test('keeps LAN device scope independent from proxy text search', () => {
  const state = readFileSync(new URL('../src/assembly/proxies/index.ts', import.meta.url), 'utf8')
  const controls = readFileSync(
    new URL('../src/components/controls/ProxiesCtrl.tsx', import.meta.url),
    'utf8',
  )

  assert.match(state, /export const proxiesFilter = ref\(''\)/)
  assert.match(controls, /const handlerLanDeviceChange[\s\S]*?proxiesDevice\.value = device/)
  assert.doesNotMatch(
    controls.match(/const handlerLanDeviceChange[\s\S]*?\n\s*}/)?.[0] ?? '',
    /proxiesFilter/,
  )
})

test('guards rule snapshots and manifests with the same asynchronous generation', () => {
  const source = readFileSync(new URL('../src/assembly/rules/index.ts', import.meta.url), 'utf8')

  assert.match(source, /const rulesRequestGuard = createGenerationGuard\(\)/)
  assert.match(source, /rulesRequestGuard\.isCurrent\(generation\)/)
  assert.match(source, /isLanRulesManifestForRules\(manifestResult\.manifest, snapshot\.rules\)/)
  assert.match(source, /rulesSnapshotKey\.value !== requestSnapshotKey\) clearRulesSnapshot\(\)/)
})

test('does not expose a previous backend rule or manifest snapshot', () => {
  const backendARules = [
    {
      type: 'SubRules',
      payload: '(SRC-IP-CIDR,192.168.50.94/32)',
      proxy: 'lan/phone',
    },
  ]

  const rules = getBackendScopedSnapshot(backendARules, 'clash:backend-a', 'clash:backend-b')
  const devices = getBackendScopedSnapshot(
    [{ name: 'phone', subRule: 'lan/phone', rules: [] }],
    'clash:backend-a',
    'clash:backend-b',
  )

  assert.equal(createLanDeviceResolver(rules)('192.168.50.94'), undefined)
  assert.deepEqual(devices, [])
})

test('shows Sub-Rules unless an active LAN manifest identifies them', () => {
  const rules = [
    { type: 'SubRules', proxy: 'lan/phone' },
    { type: 'SubRules', proxy: 'custom/sub-rule' },
    { type: 'RuleSet', proxy: 'GLOBAL' },
  ]

  assert.deepEqual(filterLanManifestSubRules(rules, []), rules)
  assert.deepEqual(filterLanManifestSubRules(rules, [{ subRule: 'lan/phone' }]), rules.slice(1))
})

test('uses LAN device names in connection display and search values', () => {
  const source = readFileSync(
    new URL('../src/assembly/connections/accessor.ts', import.meta.url),
    'utf8',
  )

  assert.match(
    source,
    /case CONNECTIONS_TABLE_ACCESSOR_KEY\.SourceIP:[\s\S]*?getLanDeviceDisplayName/,
  )
})

test('blocks the destructive core dashboard updater while managed LAN rules are active', () => {
  const source = readFileSync(
    new URL('../src/components/settings/general/GeneralSettings.vue', import.meta.url),
    'utf8',
  )
  const version = readFileSync(new URL('../src/assembly/version.ts', import.meta.url), 'utf8')
  const rules = readFileSync(new URL('../src/assembly/rules/index.ts', import.meta.url), 'utf8')

  assert.match(source, /upgradeUIAPI/)
  assert.match(source, /:disabled="!canUseCoreUIUpdater"/)
  assert.match(source, /upgradeDashboard/)
  assert.match(source, /autoUpgradeDashboard/)
  assert.match(version, /waitForLanRulesManifestCheck\(\)[\s\S]*?!canUseCoreUIUpdater\.value/)
  assert.match(
    rules,
    /watch\(\s*currentRulesSnapshotKey[\s\S]*?\{ immediate: true, flush: 'sync' \}/,
  )
})

test('keeps only the GitHub comparison status in local cache', () => {
  const source = readFileSync(new URL('../src/assembly/version.ts', import.meta.url), 'utf8')
  const response = {
    status: 'ahead' as const,
    commits: Array.from({ length: 100 }, (_, index) => ({ sha: String(index) })),
    files: Array.from({ length: 100 }, (_, index) => ({ filename: String(index) })),
  }

  assert.deepEqual(pickGitHubComparisonCacheData(response), { status: 'ahead' })
  assert.match(source, /writeLocalCache\(cacheKey, url, \{ \.\.\.cache, data: selectedData \}\)/)
  assert.match(source, /catch \(error\)[\s\S]*?Failed to cache response for/)
  assert.match(source, /pruneStaleComparisonCaches\(comparisonURL\)/)
})

test('applies proxy folders to device-scoped groups without counting generated clones', () => {
  const composable = readFileSync(new URL('../src/composables/proxies.ts', import.meta.url), 'utf8')
  const folders = readFileSync(new URL('../src/store/proxyFolders.ts', import.meta.url), 'utf8')

  assert.doesNotMatch(composable, /isProxyFolderModeActive\.value \|\| proxiesDevice\.value/)
  assert.match(folders, /getLanDeviceScopedProxyName\(groupName, device\)/)
  assert.match(folders, /filter\(\(name\) => !getLanDeviceFromScopedProxyName\(name\)\)/)
})

test('keeps device-scoped table rules read-only and uses their visible positions', () => {
  const source = readFileSync(
    new URL('../src/components/rules/RulesTable.vue', import.meta.url),
    'utf8',
  )

  assert.match(source, /getRuleDisplayNumber\(rule, index, rules\.value\)/)
  assert.match(source, /lanDevice: rulesDevice\.value/)
  assert.match(source, /rule\.readOnly \|\| \(!rule\.uuid && !rule\.extra\)/)
  assert.match(source, /renderRules\.value\.some\(\(rule\) => rule\.extra\)/)
})

test('resets the source IP filter when the active backend changes', () => {
  const source = readFileSync(new URL('../src/store/connections.ts', import.meta.url), 'utf8')

  assert.match(
    source,
    /activeBackend\.value\?\.uuid[\s\S]*?backendID !== previousBackendID[\s\S]*?sourceIPFilter\.value = null/,
  )
})

test('fails closed and propagates errors when rule or sidecar checks fail', () => {
  const source = readFileSync(new URL('../src/assembly/rules/index.ts', import.meta.url), 'utf8')

  assert.match(source, /import \{ useStorage \} from '@\/helper\/storage'/)
  assert.doesNotMatch(source, /from '@vueuse\/core'/)
  assert.match(source, /export const canUseCoreUIUpdater = computed\(\(\) =>[\s\S]*?'inactive'/)
  assert.match(
    source,
    /catch \(error\)[\s\S]*!isCurrentRequest\(\)[\s\S]*?'unavailable'[\s\S]*?throw error/,
  )
})

test('shares rebuilt source IP option arrays with the selected filter', () => {
  const source = readFileSync(
    new URL('../src/components/controls/SourceIPFilter.vue', import.meta.url),
    'utf8',
  )

  assert.match(source, /sourceIPFilter\.value = current\.value/)
  assert.doesNotMatch(source, /isEqual\(current\.value, sourceIPFilter\.value\)/)
})

test('overview cards share one connection-filter source', () => {
  const connections = readFileSync(new URL('../src/store/connections.ts', import.meta.url), 'utf8')
  const charts = readFileSync(
    new URL('../src/components/overview/ChartsCard.vue', import.meta.url),
    'utf8',
  )
  const history = readFileSync(
    new URL('../src/components/overview/ConnectionHistory.vue', import.meta.url),
    'utf8',
  )
  const globe = readFileSync(
    new URL('../src/components/overview/EarthGlobeCard.vue', import.meta.url),
    'utf8',
  )
  const topology = readFileSync(
    new URL('../src/components/overview/TopologyCharts.vue', import.meta.url),
    'utf8',
  )

  assert.match(connections, /export const overviewActiveConnections = computed/)
  assert.match(charts, /overviewActiveConnections\.value\.length/)
  assert.match(history, /overviewActiveConnections\.value/)
  assert.match(globe, /overviewActiveConnections/)
  assert.match(topology, /overviewActiveConnections\.value\.flatMap/)
})

test('relabels in-memory logs from their original payload when the resolver changes', () => {
  const source = readFileSync(
    new URL('../src/assembly/logs/accumulator.ts', import.meta.url),
    'utf8',
  )

  assert.match(source, /watch\(lanDeviceResolver, relabelStoredLogs\)/)
  assert.match(source, /const rawPayloads = new Map<number, string>\(\)/)
  assert.match(source, /labelPayload\(rawPayloads\.get\(log\.seq\) \?\? log\.payload\)/)
})

test('limits page-level latency targets to recursively reachable device leaves', () => {
  const leaves = collectProxyLeafNames(
    {
      'lan/phone/root': { all: ['lan/phone/nested', 'phone-a'] },
      'lan/phone/nested': { all: ['lan/phone/root', 'phone-b'] },
      'lan/tablet/root': { all: ['tablet-a'] },
      'phone-a': {},
      'phone-b': {},
      'tablet-a': {},
    },
    ['lan/phone/root'],
  )

  assert.deepEqual(leaves, ['phone-a', 'phone-b'])

  const controls = readFileSync(
    new URL('../src/components/controls/ProxiesCtrl.tsx', import.meta.url),
    'utf8',
  )
  assert.match(
    controls,
    /allProxiesLatencyTest\([\s\S]*?proxiesDevice\.value \? filteredProxyGroups\.value : undefined/,
  )
})

test('matches device proxy searches against the visible name', () => {
  const source = readFileSync(new URL('../src/composables/proxySearch.ts', import.meta.url), 'utf8')
  const rules = readFileSync(new URL('../src/assembly/rules/index.ts', import.meta.url), 'utf8')

  assert.match(source, /matchProxySearchKeyword\(getLanDeviceScopedProxyName\(name, lanDevice\)\)/)
  assert.match(rules, /getLanDeviceScopedProxyName\(rule\.proxy, rulesDevice\.value\)/)
})

test('skips CIDR labels whose address family does not match', () => {
  const source = readFileSync(new URL('../src/helper/sourceip.ts', import.meta.url), 'utf8')

  assert.match(source, /addr\.kind\(\) === cidr\[0\]\.kind\(\) && addr\.match\(cidr\)/)
})

test('translates LAN device control titles', () => {
  const rules = readFileSync(
    new URL('../src/components/controls/RulesCtrl.tsx', import.meta.url),
    'utf8',
  )
  const proxies = readFileSync(
    new URL('../src/components/controls/ProxiesCtrl.tsx', import.meta.url),
    'utf8',
  )
  const en = readFileSync(new URL('../src/i18n/en.ts', import.meta.url), 'utf8')

  assert.match(rules, /title=\{t\('lanDeviceRules'\)\}/)
  assert.match(proxies, /title=\{t\('lanDeviceGroups'\)\}/)
  assert.match(en, /lanDeviceRules: 'LAN device rules'/)
  assert.match(en, /lanDeviceGroups: 'LAN device groups'/)
})

test('counts device-scoped proxy groups in the Proxies tab badge', () => {
  const source = readFileSync(
    new URL('../src/components/controls/ProxiesCtrl.tsx', import.meta.url),
    'utf8',
  )

  assert.match(
    source,
    /proxiesDevice\.value\s*\?\s*filteredProxyGroups\.value\.length\s*:\s*proxyGroupList\.value\.length/,
  )
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
    version: 2,
    ruleCount: 5,
    rulesDigest: '0123456789abcdef',
    devices: [
      {
        name: 'phone',
        subRule: 'lan/phone',
        rules: [{ sourceIndex: 3, sourceProxy: 'GLOBAL', proxy: 'lan/phone/GLOBAL' }],
      },
    ],
  }

  assert.deepEqual(parseLanRulesManifest(manifest), manifest)
})

test('distinguishes a missing LAN sidecar from unreadable or invalid responses', async () => {
  const validManifest = {
    version: 2,
    ruleCount: 0,
    rulesDigest: 'cbf29ce484222325',
    devices: [],
  }
  const loaded = await loadLanRulesManifest(
    'https://gateway.example/lan-rules.json',
    async () => new Response(JSON.stringify(validManifest)),
  )
  const missing = await loadLanRulesManifest(
    'https://gateway.example/lan-rules.json',
    async () => new Response('', { status: 404 }),
  )
  const failed = await loadLanRulesManifest(
    'https://gateway.example/lan-rules.json',
    async () => new Response('', { status: 500 }),
  )
  const invalid = await loadLanRulesManifest(
    'https://gateway.example/lan-rules.json',
    async () => new Response('{'),
  )

  assert.deepEqual(loaded, { status: 'loaded', manifest: validManifest })
  assert.deepEqual(missing, { status: 'missing' })
  assert.deepEqual(failed, { status: 'error' })
  assert.deepEqual(invalid, { status: 'error' })
})

test('rejects malformed LAN rules manifest devices and bindings', () => {
  const malformed = [
    {
      version: 2,
      ruleCount: 1,
      rulesDigest: '0123456789abcdef',
      devices: [{ name: 'phone', subRule: 'lan/phone' }],
    },
    {
      version: 2,
      ruleCount: 4,
      rulesDigest: '0123456789abcdef',
      devices: [
        {
          name: 'phone',
          subRule: 'lan/phone',
          rules: [{ sourceIndex: '3', sourceProxy: 'GLOBAL', proxy: 'DIRECT' }],
        },
      ],
    },
    {
      version: 2,
      ruleCount: 4,
      rulesDigest: '0123456789abcdef',
      devices: [
        {
          name: '',
          subRule: 'lan/phone',
          rules: [{ sourceIndex: 3, sourceProxy: 'GLOBAL', proxy: 'DIRECT' }],
        },
      ],
    },
  ]

  for (const manifest of malformed) {
    assert.throws(() => parseLanRulesManifest(manifest), /invalid LAN rules manifest/)
  }
})

test('accepts manifests only for the matching backend rule snapshot', () => {
  const rules = [
    { index: 0, type: 'SubRules', payload: '(SRC-IP-CIDR,192.168.1.2/32)', proxy: 'lan/phone' },
    { index: 1, type: 'RuleSet', payload: 'openai', proxy: 'GLOBAL' },
  ]
  const manifest = parseLanRulesManifest({
    version: 2,
    ruleCount: 2,
    rulesDigest: createLanRulesDigest(rules, [1]),
    devices: [
      {
        name: 'phone',
        subRule: 'lan/phone',
        rules: [{ sourceIndex: 1, sourceProxy: 'GLOBAL', proxy: 'lan/phone/GLOBAL' }],
      },
    ],
  })
  assert.equal(isLanRulesManifestForRules(manifest, rules), true)
  assert.equal(
    isLanRulesManifestForRules(
      {
        ...manifest,
        devices: [
          {
            ...manifest.devices[0],
            rules: [{ ...manifest.devices[0].rules[0], proxy: 'lan/tablet/GLOBAL' }],
          },
        ],
      },
      rules,
    ),
    false,
  )
  assert.equal(
    isLanRulesManifestForRules(manifest, [{ ...rules[0] }, { ...rules[1], proxy: 'DIRECT' }]),
    false,
  )
  assert.equal(
    isLanRulesManifestForRules(manifest, [rules[0], { ...rules[1], payload: 'different' }]),
    false,
  )
  assert.equal(isLanRulesManifestForRules({ ...manifest, ruleCount: 3 }, rules), false)
  assert.throws(
    () =>
      parseLanRulesManifest({
        version: 2,
        ruleCount: 2,
        rulesDigest: createLanRulesDigest(rules, [1]),
        devices: [
          {
            name: 'iphone14',
            subRule: 'lan/iphone14',
            rules: [{ sourceIndex: 1, sourceProxy: 'GLOBAL', proxy: 'lan/iphone14pm/GLOBAL' }],
          },
        ],
      }),
    /invalid LAN rules manifest/,
  )
})

test('loads a LAN rules manifest only from the active backend origin', () => {
  assert.equal(
    isLanRulesManifestSameOrigin('https://gateway.example/ui/', 'https://gateway.example'),
    true,
  )
  assert.equal(
    isLanRulesManifestSameOrigin('https://gateway-a.example/ui/', 'https://gateway-b.example'),
    false,
  )
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
