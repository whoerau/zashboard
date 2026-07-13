import assert from 'node:assert/strict'
import test from 'node:test'
import {
  FORK_UI_RELEASE_DOWNLOAD_URL,
  canAutoUpgradeForkUI,
  isForkUIUpdateAvailable,
  releaseCommitFromBody,
} from '../src/helper/uiUpdate.ts'

test('detects fork dashboard updates by release build commit', () => {
  assert.equal(
    releaseCommitFromBody('Built from b2fb72cf5b80532a59bdfa35e425cab6c5b7ce61'),
    'b2fb72cf5b80532a59bdfa35e425cab6c5b7ce61',
  )

  assert.equal(
    isForkUIUpdateAvailable(
      {
        tag_name: 'lan-device-filter-latest',
        body: 'Built from b2fb72cf5b80532a59bdfa35e425cab6c5b7ce61',
      },
      'b2fb72c',
      '3.11.0',
    ),
    false,
  )

  assert.equal(
    isForkUIUpdateAvailable(
      {
        tag_name: 'lan-device-filter-latest',
        body: 'Built from c3fb72cf5b80532a59bdfa35e425cab6c5b7ce61',
      },
      'b2fb72c',
      '3.11.0',
    ),
    true,
  )
})

test('does not treat the fixed fork tag as a semver update without commit data', () => {
  assert.equal(
    isForkUIUpdateAvailable({ tag_name: 'lan-device-filter-latest', body: '' }, '', '3.11.0'),
    false,
  )
  assert.equal(isForkUIUpdateAvailable({ tag_name: 'v3.11.0', body: '' }, '', '3.11.0'), false)
  assert.equal(isForkUIUpdateAvailable({ tag_name: 'v3.12.0', body: '' }, '', '3.11.0'), true)
})

test('blocks automatic fork updates without a verified download source', () => {
  assert.equal(canAutoUpgradeForkUI(), false)
  assert.equal(canAutoUpgradeForkUI('https://example.com/other.zip'), false)
  assert.equal(canAutoUpgradeForkUI(FORK_UI_RELEASE_DOWNLOAD_URL), true)
})
