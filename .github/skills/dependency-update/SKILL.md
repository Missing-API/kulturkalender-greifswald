---
name: dependency-update
description: Safely update project dependencies (minor/patch) using pnpm. This skill enforces a "Safe-by-Default" workflow: evaluating risks based on code changes required, performing incremental updates with repo-defined checks, and tracking major upgrades via GitHub issues.
---

# Dependency Updater

Safely update project dependencies (minor/patch) using pnpm. This skill enforces a "Safe-by-Default" workflow: evaluating risks based on code changes required, performing incremental updates with repo-defined checks, and tracking major upgrades via GitHub issues.

## Workflow

### 1. Discovery & Analysis

- **Identify Updates:** Run pnpm outdated --format json (or pnpm outdated --recursive --format json in monorepos) to get current, wanted, and latest versions.
- **Security Audit:** Run pnpm audit to identify known vulnerabilities. Prioritize updates that resolve security advisories.
- **Preview Changes:** Run pnpm update --dry-run to preview what would change before applying.
- **Categorize for Separate Scoring:**
  - **Patch/Minor:** Same Major version as current. These are prioritized for immediate application.
  - **Major:** Higher Major version. **DO NOT** update these; flag them for GitHub issue creation.
- **Tooling Check:** Sync versions of pnpm, node, and turbo between package.json and Dockerfile.ci.

### 2. Risk & Impact Scoring

Evaluate updates based on the level of "healing" required to pass checks:

- **Score: Low (Standard):** Applied as a simple version bump. No code changes required to pass quality gates.
- **Score: Medium (Healed):** Minor code adjustments (e.g., fixing typos, lint errors, or uncritical type definitions) were needed to make the codebase healthy.
- **Score: High (Blocked):** Update requires breaking change refactors or significant logic shifts. **Revert and skip.**

### 3. Strategy Planning

- **Grouping:** Combine tight couples (e.g., react + react-dom) or internal workspace packages.
- **Queueing:** Sequence from Patch/Minor (Low Risk) to assessed Minor updates.

### 4. Incremental Update & Quality Gate

For each package or group:

- **Apply Update:** Use pnpm update <package> --compatible.
- **Run Quality Gate:** Execute the check script configured in the repo (priority: check, test, lint, or build).
- **Evaluate & Heal:**
  - If checks fail: Attempt 1-2 minor "healing" fixes.
  - If successful: Proceed to commit.
  - If still failing: Revert changes (git checkout) and move to Issue Management.
- **Commit:** Use the **Conventional Commits** pattern:
  - chore(deps): update <package> to v<version> (for Low score/no code changes).
  - fix(deps): update <package> to v<version> and fix [issue] (if healing was required).

### 5. Post-Update & Tracking

- **Infrastructure Sync:** Update Dockerfile.ci and CI workflows if tooling versions changed.
- **Version Bump:** Run pnpm version patch.
- **Issue Management:**
  - **Major Updates:** Search for existing issues. If missing, create one titled chore(deps): Upgrade [package] to vX (Major Candidate).
  - **Failed Updates:** For updates that were blocked/reverted, create/update an issue detailing the failure and blocking errors.

## Guidelines

### Strict Constraints

- **No Manual Edits:** Use pnpm CLI for all manifest changes. Never edit pnpm-lock.yaml manually.
- **Lockfile Hygiene:** Always commit pnpm-lock.yaml alongside version bumps. Run pnpm install --frozen-lockfile to verify lockfile integrity before committing.
- **Compatible Only:** Never run pnpm update --latest globally. Stick to --compatible to avoid unauthorized Major jumps.
- **Atomicity:** Commit after each successful update cluster or individual package.
- **Post-Update Audit:** Run pnpm audit after all updates to confirm no new vulnerabilities were introduced.
- **No Alerts:** All status updates must be logged in the console or tracked in GitHub issues.

## Examples

### Example: Successful Healed Update

- Identify eslint v8.1.0 -> v8.2.0 (Minor).
- Run pnpm update eslint.
- pnpm lint fails due to a new rule.
- Agent fixes the 2 lint errors ("Healing").
- pnpm lint passes.
- Agent commits: fix(deps): update eslint to v8.2.0 and fix lint regressions.

### Example: Major Version Handling

- Identify next v14 -> v15 (Major).
- Agent flags this as "Major Candidate".
- Agent searches GitHub. No issue found.
- Agent creates issue: chore(deps): Upgrade Next.js to v15 (Major Candidate).
