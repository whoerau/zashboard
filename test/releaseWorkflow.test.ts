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

  const verifyIndex = workflow.indexOf('origin/$GITHUB_REF_NAME')
  const createIndex = workflow.indexOf('gh release create')
  const promoteIndex = workflow.indexOf('--draft=false --latest')

  assert.ok(verifyIndex >= 0)
  assert.ok(verifyIndex < createIndex)
  assert.ok(createIndex < promoteIndex)
  assert.match(workflow, /RELEASE_TAG: lan-device-filter-\$\{\{ github\.sha \}\}/)
  assert.doesNotMatch(workflow, /git tag -f|--force/)
})
