export const FORK_UI_RELEASE_API_URL =
  'https://api.github.com/repos/whoerau/zashboard/releases/tags/lan-device-filter-latest'
export const FORK_UI_RELEASE_DOWNLOAD_URL =
  'https://github.com/whoerau/zashboard/releases/download/lan-device-filter-latest/dist.zip'

export type ForkUIRelease = {
  tag_name?: string
  body?: string
  target_commitish?: string
}

const COMMIT_RE = /\bBuilt from ([0-9a-f]{7,40})\b/i
const HEX_COMMIT_RE = /^[0-9a-f]{7,40}$/i
const SEMVER_TAG_RE = /^v\d+\.\d+\.\d+(?:[-+].*)?$/

export const releaseCommitFromBody = (body = '') => body.match(COMMIT_RE)?.[1] ?? ''

const isSameCommit = (a: string, b: string) => {
  if (!a || !b) return false
  return a.startsWith(b) || b.startsWith(a)
}

export const canAutoUpgradeForkUI = (configuredDownloadURL = '') =>
  configuredDownloadURL.trim() === FORK_UI_RELEASE_DOWNLOAD_URL

export const isForkUIUpdateAvailable = (
  release: ForkUIRelease,
  currentCommit: string,
  currentVersion: string,
) => {
  const bodyCommit = releaseCommitFromBody(release.body)
  const targetCommit = release.target_commitish?.match(HEX_COMMIT_RE)?.[0] ?? ''
  const releaseCommit = bodyCommit || targetCommit

  if (currentCommit && releaseCommit) {
    // Fork releases are pinned by commit; fixed tag names cannot express freshness.
    // fork 发布以 commit 为准；固定 tag 本身不能表达是否有新包。
    return !isSameCommit(currentCommit, releaseCommit)
  }

  if (release.tag_name?.match(SEMVER_TAG_RE)) {
    return release.tag_name !== `v${currentVersion}`
  }

  return false
}
