export const FORK_UI_RELEASE_API_URL =
  'https://api.github.com/repos/whoerau/zashboard/releases/latest'
export const FORK_UI_RELEASE_DOWNLOAD_URL =
  'https://github.com/whoerau/zashboard/releases/latest/download/dist.zip'
export const FORK_UI_COMPARE_API_URL = 'https://api.github.com/repos/whoerau/zashboard/compare'

export type ForkUIRelease = {
  tag_name?: string
  body?: string
  target_commitish?: string
}

export type GitHubComparisonStatus = 'ahead' | 'behind' | 'diverged' | 'identical'

export type GitHubComparison = {
  status: GitHubComparisonStatus
}

export const pickGitHubComparisonCacheData = ({ status }: GitHubComparison): GitHubComparison => ({
  status,
})

const COMMIT_RE = /\bBuilt from ([0-9a-f]{7,40})\b/i
const HEX_COMMIT_RE = /^[0-9a-f]{7,40}$/i
const SEMVER_TAG_RE = /^v(\d+)\.(\d+)\.(\d+)(?:[-+].*)?$/

export const releaseCommitFromBody = (body = '') => body.match(COMMIT_RE)?.[1] ?? ''

export const getForkUIReleaseCommit = (release: ForkUIRelease) => {
  const bodyCommit = releaseCommitFromBody(release.body)
  const targetCommit = release.target_commitish?.match(HEX_COMMIT_RE)?.[0] ?? ''
  return bodyCommit || targetCommit
}

export const isSameCommit = (a: string, b: string) => {
  if (!a || !b) return false
  return a.startsWith(b) || b.startsWith(a)
}

const compareSemver = (a: string, b: string) => {
  const left = a.match(SEMVER_TAG_RE)
  const right = b.match(SEMVER_TAG_RE)
  if (!left || !right) return 0

  for (let index = 1; index <= 3; index++) {
    const difference = Number(left[index]) - Number(right[index])
    if (difference) return difference
  }
  return 0
}

export const isForkUIUpdateAvailable = (
  release: ForkUIRelease,
  currentCommit: string,
  currentVersion: string,
  comparisonStatus?: GitHubComparisonStatus,
) => {
  const releaseCommit = getForkUIReleaseCommit(release)

  if (currentCommit && releaseCommit) {
    if (isSameCommit(currentCommit, releaseCommit)) return false
    // Unknown or diverged ancestry must fail closed; inequality alone can be a downgrade.
    // 未知或分叉的提交关系必须关闭更新；仅凭不相等可能导致降级。
    return comparisonStatus === 'ahead'
  }

  const currentTag = `v${currentVersion}`
  return (
    Boolean(release.tag_name?.match(SEMVER_TAG_RE)) &&
    compareSemver(release.tag_name!, currentTag) > 0
  )
}
