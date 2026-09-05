import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import test from 'node:test'

test('defines the canonical Node test command', () => {
  const packageJSON = JSON.parse(
    readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
  ) as { scripts?: Record<string, string> }

  assert.equal(packageJSON.scripts?.test, 'node --test test/*.test.ts')
})

test('runs tests before type checking and building the immutable release', () => {
  const workflow = readFileSync(
    new URL('../.github/workflows/lan-device-release.yml', import.meta.url),
    'utf8',
  )
  const testIndex = workflow.indexOf('pnpm test')
  const typeCheckIndex = workflow.indexOf('pnpm run type-check')
  const buildIndex = workflow.indexOf('pnpm run build:no-fonts')

  assert.ok(testIndex >= 0)
  assert.ok(testIndex < typeCheckIndex)
  assert.ok(typeCheckIndex < buildIndex)
})

test('keeps upstream Build and Deploy off this fork', () => {
  const workflow = readFileSync(new URL('../.github/workflows/deploy.yml', import.meta.url), 'utf8')
  const repoGuards = [...workflow.matchAll(/if: github\.repository == 'Zephyruso\/zashboard'/g)]

  assert.equal(repoGuards.length, 4)
  assert.match(workflow, /token: \$\{\{ secrets\.PAT \}\}/)
})

test('builds without write credentials and publishes from a least-privilege job', () => {
  const workflow = readFileSync(
    new URL('../.github/workflows/lan-device-release.yml', import.meta.url),
    'utf8',
  )

  assert.match(workflow, /permissions:\s*\n\s+contents: read/)
  assert.match(workflow, /persist-credentials: false/)
  assert.match(workflow, /release:[\s\S]*?permissions:\s*\n\s+contents: write/)
  assert.match(workflow, /GH_REPO: \$\{\{ github\.repository \}\}/)
  assert.match(workflow, /actions\/upload-artifact@[0-9a-f]{40}/)
  assert.match(workflow, /actions\/download-artifact@[0-9a-f]{40}/)
  assert.doesNotMatch(workflow, /uses: [^\s]+@v\d/)
})

test('verifies branch head before atomically promoting an immutable release', () => {
  const workflow = readFileSync(
    new URL('../.github/workflows/lan-device-release.yml', import.meta.url),
    'utf8',
  )

  assert.match(
    workflow,
    /concurrency:\s*\n\s+group: \$\{\{ github\.workflow \}\}-\$\{\{ github\.ref \}\}/,
  )
  assert.match(workflow, /cancel-in-progress: true/)
  assert.doesNotMatch(workflow, /workflow_dispatch/)

  const verifyIndex = workflow.indexOf('current_head_sha')
  const createIndex = workflow.indexOf('gh release create')
  const downloadIndex = workflow.indexOf('gh release download')
  const compareIndex = workflow.indexOf('cmp --silent')
  const promoteIndex = workflow.indexOf('--draft=false --latest')
  const headChecks = [...workflow.matchAll(/\$\(current_head_sha\)/g)].map((match) => match.index)
  const publishedGuardIndex = workflow.indexOf('is already published and immutable')
  const uploadIndex = workflow.indexOf('gh release upload')

  assert.ok(verifyIndex >= 0)
  assert.ok(verifyIndex < createIndex)
  assert.ok(createIndex < downloadIndex)
  assert.ok(downloadIndex < compareIndex)
  assert.ok(compareIndex < headChecks.at(-1)!)
  assert.ok(headChecks.at(-1)! < promoteIndex)
  assert.ok(headChecks.length >= 2)
  assert.ok(publishedGuardIndex >= 0)
  assert.ok(publishedGuardIndex < uploadIndex)
  assert.match(workflow, /RELEASE_TAG: lan-device-filter-\$\{\{ github\.sha \}\}/)
  assert.doesNotMatch(workflow, /git tag -f|--force/)
})

test('keeps vulnerable PWA build tooling out of production dependencies', () => {
  const packageJSON = JSON.parse(
    readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
  ) as {
    dependencies?: Record<string, string>
    devDependencies?: Record<string, string>
  }
  const workspace = readFileSync(new URL('../pnpm-workspace.yaml', import.meta.url), 'utf8')

  for (const name of ['vite-plugin-pwa', 'workbox-build', 'workbox-window']) {
    assert.equal(packageJSON.dependencies?.[name], undefined)
    assert.ok(packageJSON.devDependencies?.[name])
  }
  assert.match(workspace, /browserslist: 4\.28\.7/)
  assert.match(workspace, /fast-uri: 3\.1\.6/)
})
