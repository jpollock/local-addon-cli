---
status: completed
priority: p3
issue_id: "008"
tags: [code-review, cleanup]
dependencies: []
completed_date: 2026-01-30
---

# Dead Code and Unused Exports

## Problem Statement

Several functions, constants, and imports are defined but never used, adding confusion and maintenance burden.

## Findings

### 1. Unused constant
**Location:** `packages/cli/src/bootstrap/paths.ts` line 85
```typescript
export const LEGACY_ADDON_PACKAGE_NAME = '@local-labs/local-addon-mcp-server';
// Never imported anywhere
```

### 2. Unused function
**Location:** `packages/cli/src/bootstrap/paths.ts` lines 90-99
```typescript
export function getAddonDirPath(addonsDir: string): string {
  // Never called - bootstrap/index.ts uses ADDON_DIR_NAME constant instead
}
```

### 3. Unused import
**Location:** `packages/cli/src/bootstrap/index.ts` line 18
```typescript
import { getLocalPaths, LocalPaths, ADDON_PACKAGE_NAME } from './paths';
// ADDON_PACKAGE_NAME is imported but never used
```

### 4. Duplicate dev path logic
**Location:** `packages/cli/src/bootstrap/index.ts` lines 303-307
```typescript
const devPath = path.resolve(cliDir, '..', '..', '..', 'addon');
// This is identical to monorepoPath above it - dead code
```

### 5. Unused formatter
**Location:** `packages/cli/src/formatters/index.ts`
```typescript
export function formatWarning(...) { ... }
// Never imported or used
```

## Proposed Solutions

### Option A: Remove all dead code
- **Pros:** Cleaner codebase
- **Cons:** None
- **Effort:** Low
- **Risk:** Low

## Acceptance Criteria

- [x] Remove LEGACY_ADDON_PACKAGE_NAME
- [x] Remove getAddonDirPath function
- [x] Remove unused ADDON_PACKAGE_NAME import
- [x] Remove duplicate devPath logic
- [x] Keep formatWarning (has tests, part of public API)
- [x] Run tests to verify no regressions (181 tests pass)

## Work Log

| Date | Action | Learnings |
|------|--------|-----------|
| 2026-01-30 | Identified via simplicity review | Regularly prune dead code |
| 2026-01-30 | Removed dead code, kept formatWarning | Keep tested public API for consistency |
