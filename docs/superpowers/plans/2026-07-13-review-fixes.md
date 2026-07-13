# Review Fixes Implementation Plan

> **For Codex:** Execute this plan with `superpowers:executing-plans`; keep each behavior change covered by a failing regression test before implementation.

**Goal:** Fix every finding from the whole-branch review, verify the complete application, then rewrite the feature branch into one Conventional Commit and push it safely.

**Architecture:** Keep browser/framework modules thin by moving validation and small state rules into pure helpers. Guard asynchronous state writes with monotonically increasing generations, so an old backend/GeoIP request can finish but cannot mutate current UI state. Keep the existing public version and GeoIP APIs stable.

**Tech Stack:** Vue 3, TypeScript, Node test runner, pnpm, GitHub Actions.

---

### Task 1: Add regression tests for pure safety rules

**Files:**

- Create: `src/helper/generationGuard.ts`
- Create: `src/helper/lanRulesManifest.ts`
- Create: `src/helper/geoipDatabase.ts`
- Create: `src/helper/historyWindow.ts`
- Create: `src/helper/textContent.ts`
- Create: `test/reviewFixes.test.ts`

**Steps:**

1. Test that HTML-looking notification content is assigned through `textContent` without touching `innerHTML`.
2. Test that advancing a generation invalidates an older request token.
3. Test valid and malformed LAN manifest payloads, including missing `rules` and invalid rule fields.
4. Test that empty/whitespace GeoIP URLs resolve to the built-in URL.
5. Test that the chart window ends exactly at the latest sample.
6. Run `pnpm test`; confirm the new tests fail because helpers do not yet exist.
7. Implement only the pure helpers; rerun `pnpm test` until green.

### Task 2: Integrate notification, backend, and LAN fixes

**Files:**

- Modify: `src/helper/notification.ts`
- Modify: `src/assembly/version.ts`
- Modify: `src/assembly/rules/index.ts`

**Steps:**

1. Replace notification content HTML assignment with the tested text-content helper.
2. Refactor version fetching to return `{ version, apiVersion }` without mutating shared refs before the active-backend guard passes.
3. Capture backend UUID, backend type, and generation for every watcher run; check them after every `await` and before automatic upgrade.
4. Reset version-related refs when no backend is active or when guarded work fails for the current backend.
5. Parse LAN manifests with the tested deep schema validator before storing them or updating persisted scope selection.
6. Run focused tests and `pnpm run type-check`.

### Task 3: Integrate GeoIP and chart fixes

**Files:**

- Modify: `src/api/geoip.ts`
- Modify: `src/components/overview/MiniSparkline.vue`
- Modify: `src/components/overview/BasicCharts.vue`

**Steps:**

1. Resolve empty database settings to the built-in country/ASN URLs before lookup and cache access.
2. Snapshot URLs, language, and generation when a lookup starts.
3. Store pending lookups as `Map<ip, generation>`; ignore stale completions and only remove the matching pending generation.
4. Increment generation and clear resolved results on URL or language changes; clear readers only for URL changes.
5. Use the tested history-window helper in both charts so `xAxis.max === latest`.
6. Run focused tests and `pnpm run type-check`.

### Task 4: Serialize rolling releases

**Files:**

- Modify: `.github/workflows/lan-device-release.yml`
- Modify: `test/releaseWorkflow.test.ts`

**Steps:**

1. Add a failing workflow test requiring branch-scoped concurrency and cancellation of older runs.
2. Add top-level GitHub Actions concurrency using the workflow and ref as the group.
3. Add a final remote-branch SHA check immediately before moving the rolling tag.
4. Run `pnpm test`.

### Task 5: Remove dependency advisories

**Files:**

- Modify: `package.json`
- Modify: `pnpm-lock.yaml`

**Steps:**

1. Run `pnpm audit --prod` and retain the failing advisory result as the regression baseline.
2. Update `dompurify`, `vite`, and `vite-plugin-pwa` to patched compatible releases.
3. If transitive vulnerable versions remain, add narrow pnpm overrides for `serialize-javascript` and `esbuild`.
4. Run `pnpm install --frozen-lockfile` and `pnpm audit --prod`; require zero known advisories.

### Task 6: Full verification, squash, and push

**Files:**

- Verify all changed files.

**Steps:**

1. Run `pnpm test`, `pnpm run type-check`, `pnpm exec eslint .`, `pnpm run build`, and `pnpm audit --prod`.
2. Review `git diff --check`, the complete diff, and related Markdown documentation needs.
3. Create a temporary local safety tag at the pre-rewrite HEAD.
4. Soft-reset the branch to `upstream/main`, stage the complete branch diff, and create exactly one commit: `feat(lan): add device-aware dashboard and harden release`.
5. Confirm `upstream/main..HEAD` contains exactly one commit and the worktree is clean.
6. Push with `git push --force-with-lease origin feat/lan-device-filter`.
7. Confirm the remote branch SHA equals local HEAD, then remove the temporary safety tag.
