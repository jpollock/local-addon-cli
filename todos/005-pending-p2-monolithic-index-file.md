---
status: completed
priority: p2
issue_id: "005"
tags: [code-review, architecture]
dependencies: []
commits: [d687f4f]
completed_date: 2026-01-30
---

# Monolithic index.ts File (1531 lines → 1291 lines)

## Problem Statement

The main `index.ts` file is 1531 lines and contains all command definitions, GraphQL queries, site lookup logic, error handling, output formatting orchestration, and spinner management. This violates Single Responsibility Principle and makes the codebase difficult to maintain.

**Why it matters:** High merge conflict probability, difficult testing, no separation of concerns.

## Findings

**Location:** `/packages/cli/src/index.ts`

**Issues:**
1. 30+ command handlers with identical boilerplate
2. Inline GraphQL queries (not reusable)
3. Site lookup logic duplicated
4. Error handling repeated in every command
5. No command registration pattern

**Duplicated pattern (appears 30+ times):**
```typescript
const globalOpts = program.opts() as FormatterOptions;
const spinner = globalOpts.quiet ? null : ora(`Action...`).start();
try {
  const gql = await ensureConnected(globalOpts);
  const siteId = await findSiteId(gql, site);
  // GraphQL operation
  spinner?.succeed(`Success`);
} catch (error: any) {
  spinner?.fail(`Failed`);
  console.error(formatError(error.message));
  process.exit(1);
}
```

## Solution Implemented

### Option A: Command helper function (Quick win) ✅

```typescript
async function runSiteCommand<T>(
  siteName: string,
  config: { action: string; successMessage?: (result: T) => string },
  execute: (gql: GraphQLClient, siteId: string) => Promise<T>
): Promise<void>
```

**Commands migrated (18 total):**
- Site lifecycle: start, stop, restart, open, delete
- Site config: ssl, php, xdebug, rename, clone, export
- Database: db export, db import, db adminer
- Blueprints: save
- Backups: create, restore, delete
- WP Engine: push, pull

**Commands not migrated (different patterns):**
- Query + display (no spinner): logs, sites list/get, wpe link/history/diff, backups list/status
- No site lookup: sites create/import, wpe login/logout/status
- Raw output: wp command

## Results

- **Before:** 1531 lines
- **After:** 1291 lines
- **Reduction:** 240 lines (16%)
- **Git diff:** +68 insertions, -311 deletions (net -243 lines)

## Technical Details

- **Affected files:** `packages/cli/src/index.ts`
- **New function:** `runSiteCommand()` helper

## Acceptance Criteria

- [x] Create runSiteCommand() helper function
- [x] Refactor 3 commands to use helper as proof of concept (start/stop/restart)
- [x] Migrate remaining 15 site-specific commands (18 total migrated)
- [x] Measure LOC reduction (240 lines / 16%)
- [x] Ensure all tests pass (181 total: 112 addon + 69 CLI)
- [ ] Full decomposition into command modules (future - next major version)

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-30 | Identified via architecture review | Extract before it grows further |
| 2026-01-30 | Added runSiteCommand() helper, refactored 3 commands | Incremental improvement proves pattern |
| 2026-01-30 | Migrated 15 more commands (18 total) | -240 lines, helper pattern works well |
