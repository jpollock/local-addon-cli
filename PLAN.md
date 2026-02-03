# Execution Plan: Local CLI & MCP

> **Status: COMPLETE** - All phases implemented. See [RFC-002](docs/rfcs/002-cli-architecture.md) for final architecture.

Implementation plan for RFC-002, building the `lwp` CLI alongside the MCP Server addon.

## Overview

**Goal:** Create `@local-labs/local-cli` (the `lwp` command) that provides human-friendly access to all 40 MCP tools.

**Source Repo:** `local-addon-mcp-server` (copy, don't migrate)
**Target Repo:** `local-addon-cli-mcp` (this repo)

### Tool Inventory

| Category | Tools | Implementation |
|----------|-------|----------------|
| Site Management | 10 | MCP Tools |
| Import/Export | 4 | MCP Tools |
| Development Tools | 7 | MCP Tools |
| Blueprints & System | 3 | MCP Tools |
| Cloud Backups | 7 | GraphQL |
| WP Engine Connect | 9 | GraphQL |
| **Total** | **40** | **All implemented** |

The addon uses two mechanisms:
- **MCP Tools** (`src/main/mcp/tools/`): 24 tools for site management, WP-CLI, etc.
- **GraphQL** (`src/main/index.ts`): 16 operations for Cloud Backups and WP Engine Connect

Both are accessible via the addon's HTTP API.

---

## Phase 0: Project Setup

### 0.1 Initialize Monorepo Structure

```
local-addon-cli-mcp/
├── packages/
│   ├── addon/              # Local addon (runs inside Electron)
│   │   ├── src/
│   │   │   ├── main/       # Main process code
│   │   │   ├── renderer/   # Preferences panel (React)
│   │   │   └── common/     # Shared types
│   │   ├── bin/
│   │   │   └── mcp-stdio.js
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── cli/                # Standalone CLI
│       ├── src/
│       │   ├── index.ts    # Entry point
│       │   ├── bootstrap/  # Auto-install, auto-activate logic
│       │   ├── commands/   # Command implementations
│       │   ├── client/     # HTTP client for MCP server
│       │   └── formatters/ # Output formatting (table, json, quiet)
│       ├── bin/
│       │   └── lwp.js
│       ├── package.json
│       └── tsconfig.json
│
├── package.json            # Workspace root
├── tsconfig.base.json      # Shared TypeScript config
├── .eslintrc.json
├── .prettierrc
└── README.md
```

**Tasks:**
- [ ] Create workspace package.json with npm workspaces
- [ ] Create tsconfig.base.json with shared compiler options
- [ ] Copy .eslintrc.json, .prettierrc from old repo
- [ ] Copy .github/workflows for CI
- [ ] Create README.md with overview

### 0.2 Migrate Addon Code

Copy from `local-addon-mcp-server` to `packages/addon/`:

**Tasks:**
- [ ] Copy `src/` → `packages/addon/src/`
- [ ] Copy `bin/mcp-stdio.js` → `packages/addon/bin/`
- [ ] Copy `tests/` → `packages/addon/tests/`
- [ ] Create `packages/addon/package.json` (adapt from old package.json)
- [ ] Create `packages/addon/tsconfig.json` extending base
- [ ] Verify addon builds: `npm run build -w packages/addon`
- [ ] Verify tests pass: `npm test -w packages/addon`

### 0.3 Initialize CLI Package

**Tasks:**
- [ ] Create `packages/cli/package.json`:
  ```json
  {
    "name": "@local-labs/local-cli",
    "version": "0.0.1",
    "bin": { "lwp": "./bin/lwp.js" },
    "dependencies": {
      "commander": "^12.0.0",
      "chalk": "^5.3.0",
      "cli-table3": "^0.6.3"
    }
  }
  ```
- [ ] Create `packages/cli/tsconfig.json`
- [ ] Create `packages/cli/bin/lwp.js` shebang entry
- [ ] Create `packages/cli/src/index.ts` skeleton
- [ ] Verify CLI builds and runs: `npx lwp --version`

---

## Phase 1: CLI Foundation

### 1.1 Bootstrap System

Implement zero-friction installation from RFC-002.

**File:** `packages/cli/src/bootstrap/index.ts`

**Tasks:**
- [ ] `detectLocalInstallation()` - Find Local app on system
- [ ] `getAddonsDirectory()` - Cross-platform addons path
- [ ] `getEnabledAddonsPath()` - Path to enabled-addons.json
- [ ] `isAddonInstalled()` - Check if addon exists
- [ ] `isAddonActivated()` - Check enabled-addons.json
- [ ] `installAddon()` - Download and extract addon
- [ ] `activateAddon()` - Modify enabled-addons.json
- [ ] `isLocalRunning()` - Check if Local process is running
- [ ] `startLocal()` - Launch Local app (cross-platform)
- [ ] `stopLocal()` - Gracefully stop Local
- [ ] `waitForMcpServer()` - Poll until server responds

**File:** `packages/cli/src/bootstrap/paths.ts`

**Tasks:**
- [ ] Define platform-specific paths for macOS, Windows, Linux
- [ ] Local app executable paths
- [ ] Local data directory paths
- [ ] Connection info file path

### 1.2 MCP HTTP Client

**File:** `packages/cli/src/client/McpClient.ts`

**Tasks:**
- [ ] Read connection info from `mcp-connection-info.json`
- [ ] Implement `callTool(name, args)` method
- [ ] Handle authentication token
- [ ] Implement error handling and retries
- [ ] Add timeout configuration

**File:** `packages/cli/src/client/types.ts`

**Tasks:**
- [ ] Define `McpToolResult` type
- [ ] Define `McpError` type
- [ ] Define connection info schema

### 1.3 Command Framework

**File:** `packages/cli/src/index.ts`

**Tasks:**
- [ ] Set up Commander.js program
- [ ] Add `--version` flag
- [ ] Add `--json` global option
- [ ] Add `--quiet` global option
- [ ] Add `--no-color` global option
- [ ] Implement pre-command hook for bootstrap check
- [ ] Register all command groups

### 1.4 Output Formatters

**File:** `packages/cli/src/formatters/index.ts`

**Tasks:**
- [ ] `TableFormatter` - Pretty ASCII tables using cli-table3
- [ ] `JsonFormatter` - JSON.stringify output
- [ ] `QuietFormatter` - Minimal output (IDs/names only)
- [ ] `selectFormatter(options)` - Choose based on flags

---

## Phase 2: Core Commands

### 2.1 Sites Commands

**File:** `packages/cli/src/commands/sites.ts`

| Command | MCP Tool | Priority |
|---------|----------|----------|
| `lwp sites list` | `list_sites` | P0 |
| `lwp sites get <site>` | `get_site` | P0 |
| `lwp sites start <site>` | `start_site` | P0 |
| `lwp sites stop <site>` | `stop_site` | P0 |
| `lwp sites restart <site>` | `restart_site` | P0 |

**Tasks:**
- [ ] Implement `sites list` with table output
- [ ] Implement `sites get` with detailed output
- [ ] Implement `sites start` with status feedback
- [ ] Implement `sites stop` with status feedback
- [ ] Implement `sites restart` with status feedback
- [ ] Add `--status` filter to list (running|stopped|all)
- [ ] Add spinner/progress indicators

### 2.2 WP-CLI Command

**File:** `packages/cli/src/commands/wp.ts`

| Command | MCP Tool |
|---------|----------|
| `lwp wp <site> <cmd...>` | `wp_cli` |

**Tasks:**
- [ ] Implement `wp` command with variadic args
- [ ] Pass through all arguments after site name
- [ ] Stream output as it arrives (if possible)
- [ ] Handle command errors gracefully

### 2.3 Info Command

**File:** `packages/cli/src/commands/info.ts`

| Command | MCP Tool |
|---------|----------|
| `lwp info` | `get_local_info` |

**Tasks:**
- [ ] Implement `info` command
- [ ] Display Local version, platform, paths
- [ ] Show addon version
- [ ] Show MCP server status

---

## Phase 3: Full Site Commands

### 3.1 Site CRUD

**File:** `packages/cli/src/commands/sites.ts` (extend)

| Command | MCP Tool |
|---------|----------|
| `lwp sites create <name>` | `create_site` |
| `lwp sites delete <site>` | `delete_site` |
| `lwp sites clone <site> <new>` | `clone_site` |
| `lwp sites rename <site> <new>` | `rename_site` |
| `lwp sites open <site>` | `open_site` |

**Tasks:**
- [ ] Implement `sites create` with options (--php, --webserver)
- [ ] Implement `sites delete` with --confirm requirement
- [ ] Implement `sites clone`
- [ ] Implement `sites rename`
- [ ] Implement `sites open`

### 3.2 Import/Export

| Command | MCP Tool |
|---------|----------|
| `lwp sites export <site>` | `export_site` |
| `lwp sites import <zip>` | `import_site` |

**Tasks:**
- [ ] Implement `sites export` with --output option
- [ ] Implement `sites import` with --name option
- [ ] Show progress for long operations

---

## Phase 4: Database Commands

**File:** `packages/cli/src/commands/db.ts`

| Command | MCP Tool |
|---------|----------|
| `lwp db export <site>` | `export_database` |
| `lwp db import <site> <file>` | `import_database` |
| `lwp db adminer <site>` | `open_adminer` |

**Tasks:**
- [ ] Implement `db export` with --output option
- [ ] Implement `db import` with file path validation
- [ ] Implement `db adminer` to open browser

---

## Phase 5: Development Commands

**File:** `packages/cli/src/commands/dev.ts`

| Command | MCP Tool |
|---------|----------|
| `lwp dev logs <site>` | `get_site_logs` |
| `lwp dev xdebug <site>` | `toggle_xdebug` |
| `lwp dev ssl <site>` | `trust_ssl` |
| `lwp dev php <site>` | `change_php_version` |

**Tasks:**
- [ ] Implement `dev logs` with --type and --lines options
- [ ] Implement `dev xdebug` with --enable/--disable flags
- [ ] Implement `dev ssl` with --trust flag
- [ ] Implement `dev php` with --version option

**File:** `packages/cli/src/commands/services.ts`

| Command | MCP Tool |
|---------|----------|
| `lwp services list` | `list_services` |

**Tasks:**
- [ ] Implement `services list` with --type filter

---

## Phase 6: Blueprints

**File:** `packages/cli/src/commands/blueprints.ts`

| Command | MCP Tool |
|---------|----------|
| `lwp blueprints list` | `list_blueprints` |
| `lwp blueprints save <site>` | `save_blueprint` |

**Tasks:**
- [ ] Implement `blueprints list`
- [ ] Implement `blueprints save` with --name option

---

## Phase 7: Cloud Backups

> **Note:** These operations use GraphQL in `src/main/index.ts`, not MCP tools.

**File:** `packages/cli/src/commands/backups.ts`

| Command | GraphQL Operation |
|---------|-------------------|
| `lwp backups status` | `backupStatus` query |
| `lwp backups list <site>` | `listBackups` query |
| `lwp backups create <site>` | `createBackup` mutation |
| `lwp backups restore <site>` | `restoreBackup` mutation |
| `lwp backups delete <site>` | `deleteBackup` mutation |
| `lwp backups download <site>` | `downloadBackup` mutation |
| `lwp backups edit-note <site>` | `editBackupNote` mutation |

**Tasks:**
- [ ] Implement all backup CLI commands
- [ ] Add --provider option (dropbox|googleDrive)
- [ ] Add --snapshot option for specific backup selection
- [ ] Add --confirm for destructive operations
- [ ] Add --note option for create and edit-note

---

## Phase 8: WP Engine Connect

> **Note:** These operations use GraphQL in `src/main/index.ts`, not MCP tools.

**File:** `packages/cli/src/commands/wpe.ts`

| Command | GraphQL Operation |
|---------|-------------------|
| `lwp wpe status` | `wpeStatus` query |
| `lwp wpe login` | `wpeAuthenticate` mutation |
| `lwp wpe logout` | `wpeLogout` mutation |
| `lwp wpe sites list` | `listWpeSites` query |
| `lwp wpe link <site>` | `getWpeLink` query |
| `lwp wpe push <site>` | `pushToWpe` mutation |
| `lwp wpe pull <site>` | `pullFromWpe` mutation |
| `lwp wpe history <site>` | `getSyncHistory` query |
| `lwp wpe changes <site>` | `getSiteChanges` query |

**Tasks:**
- [ ] Implement all WPE CLI commands
- [ ] Handle OAuth flow for login (opens browser)
- [ ] Add --include-db option for push/pull
- [ ] Add --confirm for push/pull
- [ ] Add --direction option for changes

---

## Phase 9: Polish & Release

### 9.1 Testing

**Tasks:**
- [ ] Unit tests for bootstrap logic
- [ ] Unit tests for MCP client
- [ ] Unit tests for formatters
- [ ] Integration tests for each command group
- [ ] E2E test: fresh install → sites list

### 9.2 Documentation

**Tasks:**
- [ ] Update README.md with CLI usage
- [ ] Create man pages or --help documentation
- [ ] Update addon Preferences panel with CLI Setup tab
- [ ] Update RFC-002 status to "Implemented"

### 9.3 CI/CD

**Tasks:**
- [ ] GitHub Actions workflow for testing
- [ ] Workflow to publish addon to GitHub Releases
- [ ] Workflow to publish CLI to npm

### 9.4 Release

**Tasks:**
- [ ] Version 0.1.0 for initial CLI release
- [ ] Publish `@local-labs/local-addon-cli-mcp` to npm (addon)
- [ ] Publish `@local-labs/local-cli` to npm (CLI)
- [ ] Create GitHub release with changelog

---

## Milestones

| Milestone | Phases | Description |
|-----------|--------|-------------|
| **M1: Foundation** | 0-1 | Project setup, bootstrap, client |
| **M2: MVP** | 2 | Core commands work: sites, wp, info |
| **M3: Full Sites** | 3-4 | Complete site and database management |
| **M4: Dev Tools** | 5-6 | Development and blueprint commands |
| **M5: Cloud** | 7-8 | Backups and WP Engine integration |
| **M6: Release** | 9 | Testing, docs, publish |

---

## Open Questions

1. **Addon bundling:** Should CLI bundle the addon tarball, or download on first run?
   - Bundling: Larger npm package, but works offline
   - Download: Smaller package, requires network

2. **Update mechanism:** How does CLI update the addon when new versions release?
   - Option A: `lwp update` command
   - Option B: Check on each run, prompt to update
   - Option C: Separate npm update for addon package

3. **Headless mode:** Should Local support a headless mode for CI/CD?
   - Currently Local is a GUI app
   - CLI could start it minimized/hidden

4. **Streaming output:** Can MCP server stream wp_cli output, or only return complete?
   - Affects UX for long-running WP-CLI commands

---

## Next Steps

1. **Start Phase 0.1:** Create monorepo structure
2. **Start Phase 0.2:** Copy addon code from old repo
3. **Validate:** Ensure addon still builds and tests pass
4. **Start Phase 0.3:** Initialize CLI package skeleton
