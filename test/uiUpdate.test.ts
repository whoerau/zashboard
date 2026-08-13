import assert from 'node:assert/strict'
import test from 'node:test'
import {
  FORK_UI_RELEASE_DOWNLOAD_URL,
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
        tag_name: 'lan-device-filter-b2fb72cf5b80532a59bdfa35e425cab6c5b7ce61',
        body: 'Built from b2fb72cf5b80532a59bdfa35e425cab6c5b7ce61',
      },
      'b2fb72c',
      '3.11.0',
      'ahead',
    ),
    false,
  )

  assert.equal(
    isForkUIUpdateAvailable(
      {
        tag_name: 'lan-device-filter-c3fb72cf5b80532a59bdfa35e425cab6c5b7ce61',
        body: 'Built from c3fb72cf5b80532a59bdfa35e425cab6c5b7ce61',
      },
      'b2fb72c',
      '3.11.0',
      'ahead',
    ),
    true,
  )
})

test('requires release ancestry and never treats an older release as an update', () => {
  assert.equal(
    isForkUIUpdateAvailable(
      { body: 'Built from c3fb72cf5b80532a59bdfa35e425cab6c5b7ce61' },
      'b2fb72c',
      '3.11.0',
      'behind',
    ),
    false,
  )
  assert.equal(
    isForkUIUpdateAvailable(
      { body: 'Built from c3fb72cf5b80532a59bdfa35e425cab6c5b7ce61' },
      'b2fb72c',
      '3.11.0',
    ),
    false,
  )
  assert.equal(isForkUIUpdateAvailable({ tag_name: 'v3.11.0', body: '' }, '', '3.11.0'), false)
  assert.equal(isForkUIUpdateAvailable({ tag_name: 'v3.12.0', body: '' }, '', '3.11.0'), true)
  assert.equal(isForkUIUpdateAvailable({ tag_name: 'v3.10.0', body: '' }, '', '3.11.0'), false)
})

test('uses the atomically promoted latest release asset', () => {
  assert.equal(
    FORK_UI_RELEASE_DOWNLOAD_URL,
    'https://github.com/whoerau/zashboard/releases/latest/download/dist.zip',
  )
})
