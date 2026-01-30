# Local CLI & MCP

[![CI](https://github.com/local-labs/local-addon-cli-mcp/actions/workflows/ci.yml/badge.svg)](https://github.com/local-labs/local-addon-cli-mcp/actions/workflows/ci.yml)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)

Command-line interface and AI tool integration for [Local](https://localwp.com).

## Overview

This monorepo contains two packages:

| Package | Description | npm |
|---------|-------------|-----|
| `@local-labs/local-addon-cli-mcp` | Local addon providing MCP server | [Link](https://www.npmjs.com/package/@local-labs/local-addon-cli-mcp) |
| `@local-labs/local-cli` | CLI tool (`lwp` command) | [Link](https://www.npmjs.com/package/@local-labs/local-cli) |

## Quick Start

### CLI Installation

```bash
npm install -g @local-labs/local-cli

# List all sites
lwp sites list

# Start a site
lwp sites start my-blog

# Run WP-CLI commands
lwp wp my-blog plugin list
```

### AI Tool Integration

The addon enables AI tools like Claude Code to manage your WordPress development sites through the [Model Context Protocol](https://modelcontextprotocol.io/).

## Features

- **40 MCP Tools**: Complete site management, WP-CLI, database, cloud backups, and WP Engine sync
- **Human-Friendly CLI**: Familiar command-line patterns (`lwp sites list`)
- **Zero-Friction Install**: CLI automatically installs and activates the addon
- **Dual Transport**: stdio for Claude Code, SSE for web-based AI tools

## Documentation

- [CLI Usage](docs/CLI-USAGE.md)
- [AI Tool Setup](docs/AI-TOOL-SETUP.md)
- [RFC-002: CLI Design](docs/RFC-002-CLI.md)

## Development

```bash
# Install dependencies
npm install

# Build all packages
npm run build

# Run tests
npm test

# Build specific package
npm run build:addon
npm run build:cli
```

## Repository Structure

```
local-addon-cli-mcp/
├── packages/
│   ├── addon/          # Local addon (MCP server)
│   └── cli/            # CLI tool (lwp command)
├── docs/               # Documentation
├── package.json        # Workspace root
└── tsconfig.base.json  # Shared TypeScript config
```

## License

MIT License - see [LICENSE](LICENSE) for details.
