---
layout: default
title: RFC-002 CLI for Local
---

# RFC-002: Command Line Interface for Local

**Status:** Draft
**Author:** Jeremy Pollock
**Created:** 2026-01-30
**Related:** RFC-001-MCP-Server

## Summary

Add a command-line interface (CLI) that provides human-friendly access to all 40 MCP tools, enabling developers and scripts to manage Local sites without requiring an AI assistant.

## Motivation

The MCP Server addon currently serves AI tools (Claude Code, Claude.ai) via stdio and SSE transports. However, developers often want to:

- Script site management tasks
- Use familiar CLI patterns (`lwp sites list`)
- Integrate with shell scripts, CI/CD, and other automation
- Manage sites without opening Local's UI

The MCP infrastructure already exists. A CLI would be a thin client that translates human-friendly commands into MCP tool calls.

## Architecture

```
┌─────────────────────────────────────────────────────┐
│                     Local App                        │
│  ┌───────────────────────────────────────────────┐  │
│  │              Local CLI Addon                   │  │
│  │   ┌─────────────┐  ┌───────────────────────┐  │  │
│  │   │ HTTP Server │  │ GraphQL Extensions    │  │  │
│  │   │ (MCP API)   │  │ (Backups, WPE, etc)   │  │  │
│  │   └─────────────┘  └───────────────────────┘  │  │
│  │          │                                     │  │
│  │          ▼                                     │  │
│  │   ┌───────────────────────────────────────┐   │  │
│  │   │         Local Services                 │   │  │
│  │   │  siteData, wpCli, siteProcessManager  │   │  │
│  │   └───────────────────────────────────────┘   │  │
│  └───────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────┘
        ▲                    ▲                ▲
        │ HTTP               │ stdio          │ SSE
        │                    │                │
   ┌────┴────┐          ┌────┴────┐     ┌────┴────┐
   │   lwp   │          │ Claude  │     │Claude.ai│
   │  (CLI)  │          │  Code   │     │ ChatGPT │
   └─────────┘          └─────────┘     └─────────┘
```

### Key Insight

The CLI does NOT run inside Local. It's a standalone Node.js program that:

1. Reads connection info from `mcp-connection-info.json`
2. Makes HTTP requests to the addon's MCP server
3. Formats JSON responses for human consumption

The **addon is required** because it:

- Runs inside Local's Electron process
- Has access to Local's internal services
- Provides the HTTP API that the CLI connects to

## Addon Naming and Branding Changes

### Current State

| Item             | Current Value                                |
| ---------------- | -------------------------------------------- |
| Package name     | `@local-labs/local-addon-mcp-server`         |
| Product name     | `MCP Server`                                 |
| Preferences menu | `MCP Server`                                 |
| Description      | "MCP server for Local, enabling AI tools..." |

### Proposed Changes

| Item             | New Value                                                  |
| ---------------- | ---------------------------------------------------------- |
| Package name     | `@local-labs/local-addon-cli-mcp`                          |
| Product name     | `Local CLI & MCP`                                          |
| Preferences menu | `CLI & AI Tools`                                           |
| Description      | "Command-line interface and AI tool integration for Local" |

### Coexistence: CLI and MCP Work Together

The CLI does NOT replace MCP. Both are clients of the same addon backend:

```
┌────────────────────────────────────────────────────┐
│                  Local App                          │
│  ┌──────────────────────────────────────────────┐  │
│  │      Addon Backend (runs inside Local)        │  │
│  │   HTTP Server + GraphQL + 40 MCP Tools        │  │
│  └──────────────────────────────────────────────┘  │
└────────────────────────────────────────────────────┘
        ▲              ▲              ▲
        │ HTTP         │ stdio        │ SSE
        │              │              │
   ┌────┴────┐    ┌────┴────┐    ┌────┴────┐
   │   lwp   │    │ Claude  │    │Claude.ai│
   │  (CLI)  │    │  Code   │    │ ChatGPT │
   └─────────┘    └─────────┘    └─────────┘
```

All three work **simultaneously**:

- **lwp** (CLI) → HTTP requests to addon
- **Claude Code** → stdio JSON-RPC to addon
- **Claude.ai/ChatGPT** → SSE to addon

The addon remains an MCP server. The CLI is an additional human-friendly client.

### Preferences Panel Updates

The current Preferences panel has two tabs:

- **Status & Controls** - Server status, start/stop, connection info
- **AI Tool Setup** - Configuration for Claude Code, Claude.ai, etc.

Proposed three tabs:

- **Status & Controls** - Server status, start/stop, connection info (unchanged)
- **CLI Setup** - Installation instructions for the CLI (NEW)
- **AI Tool Setup** - Configuration for Claude Code, Claude.ai, etc. (unchanged)

#### CLI Setup Tab Content

```
CLI Installation

Install the Local CLI globally:

  npm install -g @local-labs/local-cli

Usage:

  lwp sites list              # List all sites
  lwp sites start my-blog     # Start a site
  lwp wp my-blog plugin list  # Run WP-CLI
  lwp --help                  # Show all commands

The CLI connects to Local automatically when it's running.
```

## Distribution

| Component | Install Method                         | Published To    |
| --------- | -------------------------------------- | --------------- |
| **Addon** | Local → Add-ons → Install from disk    | GitHub Releases |
| **CLI**   | `npm install -g @local-labs/local-cli` | npm registry    |

### Why Two Packages?

The addon and CLI have different distribution needs:

- **Addon**: Must be a `.tgz` file installed into Local's addons directory
- **CLI**: Should be a global npm package for easy installation and updates

However, they live in the **same repository** to share:

- TypeScript types
- Tool definitions
- Test utilities

### Repository Structure

```
local-addon-cli-mcp/
├── src/
│   ├── main/           # Addon main process (runs in Local)
│   ├── renderer/       # Addon preferences panel
│   ├── cli/            # CLI source (standalone)
│   │   ├── index.ts    # CLI entry point
│   │   ├── commands/   # Command implementations
│   │   └── formatters/ # Output formatting
│   └── common/         # Shared types and utilities
├── bin/
│   ├── mcp-stdio.js    # MCP stdio transport (for AI tools)
│   └── lwp.js          # CLI entry point
├── package.json        # Addon package
└── cli/
    └── package.json    # CLI package (separate for npm publishing)
```

## Installation Experience

### Zero-Friction Goal

The ideal user experience is:

```bash
npm install -g @local-labs/local-cli
lwp sites list
```

That's it. No manual addon download, no toggling switches in Local's UI, no restarts. The CLI handles everything automatically.

### Installation Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    User runs: lwp sites list                     │
└─────────────────────────────────────────────────────────────────┘
                               │
                               ▼
                    ┌─────────────────────┐
                    │ Is Local installed? │
                    └─────────────────────┘
                       │              │
                      No             Yes
                       │              │
                       ▼              ▼
              ┌─────────────┐  ┌─────────────────────┐
              │ Error with  │  │ Is addon installed? │
              │ install URL │  └─────────────────────┘
              └─────────────┘         │          │
                                     No         Yes
                                      │          │
                                      ▼          ▼
                           ┌──────────────┐  ┌─────────────────┐
                           │ Auto-install │  │ Is addon active?│
                           │ addon to     │  └─────────────────┘
                           │ addons dir   │      │          │
                           └──────────────┘     No         Yes
                                  │              │          │
                                  └──────┬───────┘          │
                                         ▼                  │
                              ┌─────────────────────┐       │
                              │ Auto-activate addon │       │
                              │ in enabled-addons   │       │
                              └─────────────────────┘       │
                                         │                  │
                                         ▼                  │
                              ┌─────────────────────┐       │
                              │ Is Local running?   │       │
                              └─────────────────────┘       │
                                    │          │            │
                                   No         Yes           │
                                    │          │            │
                                    ▼          ▼            │
                          ┌──────────────┐  ┌─────────────┐ │
                          │ Start Local  │  │ Restart     │ │
                          │ (headless)   │  │ Local       │ │
                          └──────────────┘  └─────────────┘ │
                                    │          │            │
                                    └────┬─────┘            │
                                         ▼                  │
                              ┌─────────────────────┐       │
                              │ Wait for MCP server │◄──────┘
                              │ to be ready         │
                              └─────────────────────┘
                                         │
                                         ▼
                              ┌─────────────────────┐
                              │ Execute command     │
                              └─────────────────────┘
```

### Auto-Install Addon

The CLI bundles the addon or downloads it on first run:

```typescript
async function ensureAddonInstalled(): Promise<void> {
  const addonsDir = getAddonsDirectory();
  const addonPath = path.join(addonsDir, '@local-labs', 'local-addon-cli-mcp');

  if (!fs.existsSync(addonPath)) {
    console.log('Installing Local CLI & MCP addon...');

    // Option 1: Download from GitHub Releases
    const release = await fetchLatestRelease('local-labs/local-addon-cli-mcp');
    await downloadAndExtract(release.tarball_url, addonPath);

    // Option 2: Download from npm (if published)
    // await exec('npm pack @local-labs/local-addon-cli-mcp');
    // await extractTarball('./local-addon-cli-mcp-*.tgz', addonPath);
  }
}

function getAddonsDirectory(): string {
  switch (process.platform) {
    case 'darwin':
      return path.join(os.homedir(), 'Library/Application Support/Local/addons');
    case 'win32':
      return path.join(process.env.APPDATA!, 'Local/addons');
    case 'linux':
      return path.join(os.homedir(), '.config/Local/addons');
  }
}
```

### Auto-Activate Addon

Modify `enabled-addons.json` to activate without UI interaction:

```typescript
async function ensureAddonActivated(): Promise<boolean> {
  const prefsPath = getEnabledAddonsPath();

  let enabledAddons: Record<string, boolean> = {};
  if (fs.existsSync(prefsPath)) {
    enabledAddons = JSON.parse(fs.readFileSync(prefsPath, 'utf-8'));
  }

  if (enabledAddons['@local-labs/local-addon-cli-mcp'] === true) {
    return false; // Already active, no restart needed
  }

  enabledAddons['@local-labs/local-addon-cli-mcp'] = true;
  fs.writeFileSync(prefsPath, JSON.stringify(enabledAddons, null, 2));

  return true; // Restart needed
}

function getEnabledAddonsPath(): string {
  switch (process.platform) {
    case 'darwin':
      return path.join(os.homedir(), 'Library/Application Support/Local/enabled-addons.json');
    case 'win32':
      return path.join(process.env.APPDATA!, 'Local/enabled-addons.json');
    case 'linux':
      return path.join(os.homedir(), '.config/Local/enabled-addons.json');
  }
}
```

### Auto-Start/Restart Local

Control Local app lifecycle from the CLI:

```typescript
async function ensureLocalRunning(needsRestart: boolean): Promise<void> {
  const isRunning = await isLocalRunning();

  if (needsRestart && isRunning) {
    console.log('Restarting Local to activate addon...');
    await stopLocal();
    await delay(2000);
  }

  if (!isRunning || needsRestart) {
    console.log('Starting Local...');
    await startLocal();
    await waitForMcpServer();
  }
}

async function isLocalRunning(): Promise<boolean> {
  switch (process.platform) {
    case 'darwin':
      const { stdout } = await exec('pgrep -x "Local"');
      return stdout.trim().length > 0;
    case 'win32':
      const { stdout: winOut } = await exec('tasklist /FI "IMAGENAME eq Local.exe"');
      return winOut.includes('Local.exe');
    case 'linux':
      const { stdout: linuxOut } = await exec('pgrep -x "local"');
      return linuxOut.trim().length > 0;
  }
}

async function startLocal(): Promise<void> {
  switch (process.platform) {
    case 'darwin':
      await exec('open -a "Local"');
      break;
    case 'win32':
      await exec('start "" "C:\\Program Files\\Local\\Local.exe"');
      break;
    case 'linux':
      await exec('local &');
      break;
  }
}

async function stopLocal(): Promise<void> {
  switch (process.platform) {
    case 'darwin':
      await exec('osascript -e \'quit app "Local"\'');
      break;
    case 'win32':
      await exec('taskkill /IM Local.exe');
      break;
    case 'linux':
      await exec('pkill -x local');
      break;
  }
}

async function waitForMcpServer(timeout = 30000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeout) {
    try {
      const response = await fetch('http://127.0.0.1:5890/health');
      if (response.ok) return;
    } catch {
      // Server not ready yet
    }
    await delay(500);
  }
  throw new Error('Timed out waiting for Local MCP server');
}
```

### Edge Cases

| Scenario                           | Behavior                                                                         |
| ---------------------------------- | -------------------------------------------------------------------------------- |
| Local not installed                | Error with download link: "Local is required. Download from https://localwp.com" |
| Addon update available             | Check on `lwp --version`, prompt user to update                                  |
| Local running but addon not loaded | Restart Local automatically                                                      |
| MCP server port in use             | Detect conflict, suggest resolution                                              |
| Network offline (first install)    | Error with manual install instructions                                           |
| Permission denied (addons dir)     | Error with sudo/admin instructions                                               |

### First Run Experience

```
$ npm install -g @local-labs/local-cli

$ lwp sites list
Local CLI & MCP addon not found.
Installing addon... done.
Activating addon... done.
Starting Local... done.
Waiting for MCP server... ready.

┌─────────────┬───────────────────────┬─────────┐
│ Name        │ Domain                │ Status  │
├─────────────┼───────────────────────┼─────────┤
│ my-blog     │ my-blog.local         │ stopped │
│ test-site   │ test-site.local       │ stopped │
└─────────────┴───────────────────────┴─────────┘
```

Subsequent runs are instant since everything is already set up.

## CLI Design

### Command Structure

```bash
lwp <resource> <action> [options]
```

### Commands

#### Site Management

```bash
lwp sites list [--status=running|stopped|all]
lwp sites get <site>
lwp sites start <site>
lwp sites stop <site>
lwp sites restart <site>
lwp sites create <name> [--php=8.2] [--webserver=nginx]
lwp sites delete <site> --confirm
lwp sites clone <site> <new-name>
lwp sites rename <site> <new-name>
lwp sites open <site>
lwp sites export <site> [--output=path]
lwp sites import <zip-path> [--name=site-name]
```

#### WP-CLI

```bash
lwp wp <site> <command...>

# Examples:
lwp wp my-blog plugin list
lwp wp my-blog theme activate flavor
lwp wp my-blog user create bob bob@example.com --role=editor
```

#### Database

```bash
lwp db export <site> [--output=path]
lwp db import <site> <sql-file>
lwp db adminer <site>
```

#### Development

```bash
lwp dev logs <site> [--type=php|nginx|mysql|all] [--lines=100]
lwp dev xdebug <site> --enable|--disable
lwp dev ssl <site> --trust
lwp dev php <site> --version=8.2.10
lwp services list [--type=php|database|webserver]
```

#### Blueprints

```bash
lwp blueprints list
lwp blueprints save <site> [--name=blueprint-name]
```

#### Cloud Backups

```bash
lwp backups status
lwp backups list <site> --provider=dropbox|googleDrive
lwp backups create <site> --provider=dropbox [--note="description"]
lwp backups restore <site> --provider=dropbox --snapshot=<id> --confirm
lwp backups delete <site> --provider=dropbox --snapshot=<id> --confirm
lwp backups download <site> --provider=dropbox --snapshot=<id>
```

#### WP Engine Connect

```bash
lwp wpe status
lwp wpe login
lwp wpe logout
lwp wpe sites list
lwp wpe link <site>
lwp wpe push <site> [--include-db] --confirm
lwp wpe pull <site> [--include-db] --confirm
lwp wpe history <site>
lwp wpe changes <site> [--direction=push|pull]
```

#### System

```bash
lwp info                    # Local app info
lwp --version               # CLI version
lwp --help                  # Help
```

### Output Formats

```bash
# Default: Human-readable tables
lwp sites list
┌─────────────┬───────────────────────┬─────────┐
│ Name        │ Domain                │ Status  │
├─────────────┼───────────────────────┼─────────┤
│ my-blog     │ my-blog.local         │ running │
│ test-site   │ test-site.local       │ stopped │
└─────────────┴───────────────────────┴─────────┘

# JSON output for scripting
lwp sites list --json
[{"id":"abc123","name":"my-blog","status":"running",...}]

# Quiet mode (just IDs/names)
lwp sites list --quiet
my-blog
test-site
```

## Implementation Plan

### Phase 1: CLI Foundation

- [ ] Create `src/cli/` directory structure
- [ ] Implement HTTP client to connect to MCP server
- [ ] Implement connection info reader
- [ ] Create command parser (using commander.js or similar)
- [ ] Add `--json` and `--quiet` output options

### Phase 2: Core Commands

- [ ] `lwp sites list|get|start|stop|restart`
- [ ] `lwp wp <site> <command>`
- [ ] `lwp info`
- [ ] `lwp --help`

### Phase 3: Full Command Set

- [ ] Site CRUD: create, delete, clone, rename, export, import
- [ ] Database: export, import, adminer
- [ ] Development: logs, xdebug, ssl, php
- [ ] Blueprints: list, save

### Phase 4: Cloud Integration

- [ ] Cloud backups commands
- [ ] WP Engine connect commands

### Phase 5: Polish

- [ ] Update addon name and branding
- [ ] Update Preferences panel with CLI Setup tab
- [ ] Publish CLI to npm
- [ ] Update documentation

## Security Considerations

1. **Localhost Only** - The MCP server only accepts connections from 127.0.0.1
2. **Token Authentication** - CLI uses the same auth token as AI tools
3. **Confirmation Required** - Destructive operations require `--confirm` flag
4. **No Credential Storage** - CLI reads token from connection-info.json, doesn't store it

## Alternatives Considered

### 1. Standalone CLI with GraphQL

Build CLI that speaks directly to Local's GraphQL API.

**Rejected because:**

- Would duplicate all MCP tool logic
- GraphQL connection info changes per session
- Harder to maintain two implementations

### 2. CLI as Separate Repository

Keep CLI in its own repo.

**Rejected because:**

- Harder to keep types in sync
- Duplicate CI/CD setup
- CLI is tightly coupled to addon's MCP API

### 3. No CLI, Just MCP

Rely on AI tools for all automation.

**Rejected because:**

- Not all users want AI-assisted workflows
- Shell scripts and CI/CD need programmatic access
- Power users expect CLI tools

## Decisions

1. **CLI package name**: `@local-labs/local-cli`
2. **Command prefix**: `lwp`
3. **Auto-start Local**: Yes, CLI should attempt to start Local if not running
4. **Publish addon to npm**: Yes, in addition to GitHub Releases

## References

- [RFC-001: MCP Server](RFC-001-MCP-Server.md)
- [Model Context Protocol](https://modelcontextprotocol.io/)
- [Commander.js](https://github.com/tj/commander.js/) - CLI framework
- [GitHub CLI](https://cli.github.com/) - Similar architecture pattern
