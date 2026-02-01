# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

### Added

- Anonymous usage analytics with opt-in/opt-out (Phase 1 - local only)
  - `lwp analytics status` - Show analytics status
  - `lwp analytics on` - Enable analytics
  - `lwp analytics off` - Disable analytics
  - `lwp analytics show` - View usage summary (or `--json` for raw events)
  - `lwp analytics reset` - Delete all data
- First-run opt-in prompt (defaults to opt-out in non-interactive mode)
- Auto-disable analytics in CI environments
- Command exclusions for sensitive commands (wpe.*, analytics.*)

## [0.0.5] - 2025-01-31

### Fixed

- `--with-plugins` and `--with-themes` now work correctly (must be placed before site name)
- Updated documentation to clarify option placement

## [0.0.4] - 2025-01-31

### Added

- `--with-plugins` flag for `lwp wp` to load plugins (needed for plugin-provided CLI commands like `wp migrate`)
- `--with-themes` flag for `lwp wp` to load themes
- Destructive command warnings in Claude Code skill

### Changed

- Disabled automated npm publishing (manual publish for now)

## [0.0.3] - 2025-01-31

### Fixed

- WP-CLI flags (e.g., `--activate`) now pass through correctly instead of being parsed by the CLI

### Changed

- Added automated npm publishing via GitHub Actions on version tags

## [0.0.2] - 2025-01-30

### Added

- `lwp update` command for self-updating the CLI
- `lwp update --check` to check for updates without installing
- Automatic update check on startup (cached for 24 hours)
- `lwp skill install` command for Claude Code integration
- Claude Code skill for AI assistant support
- Mermaid architecture diagrams in documentation

### Changed

- Addon is now bundled in the CLI npm package (no separate download)
- MCP server disabled (CLI-only mode)
- Preferences UI disabled in Local

### Fixed

- Package name updated to `@local-labs-jpollock/local-cli`

## [0.0.1] - 2025-01-30

### Added

- Initial release of Local CLI (`lwp`)
- Site management commands: list, get, start, stop, restart, create, delete, clone, export, import, open, rename
- WP-CLI integration: run any WP-CLI command against Local sites
- Database operations: export, import, open Adminer
- Cloud backup support: Dropbox and Google Drive integration
- WP Engine sync: push/pull sites with file and database support
- Blueprint management: save and reuse site configurations
- Lightning Services info: view available PHP, MySQL, nginx versions
- SSL certificate trust command
- PHP version switching
- Xdebug toggle
- Site log viewing
- Auto-install of CLI addon on first run
- JSON and quiet output modes for scripting
- Cross-platform support: macOS, Windows, Linux

### Technical

- TypeScript codebase with strict type checking
- GraphQL client for Local communication
- Comprehensive test suite (unit and E2E)
- Monorepo structure with addon and CLI packages

[Unreleased]: https://github.com/jpollock/local-addon-cli/compare/v0.0.5...HEAD
[0.0.5]: https://github.com/jpollock/local-addon-cli/compare/v0.0.4...v0.0.5
[0.0.4]: https://github.com/jpollock/local-addon-cli/compare/v0.0.3...v0.0.4
[0.0.3]: https://github.com/jpollock/local-addon-cli/compare/v0.0.2...v0.0.3
[0.0.2]: https://github.com/jpollock/local-addon-cli/compare/v0.0.1...v0.0.2
[0.0.1]: https://github.com/jpollock/local-addon-cli/releases/tag/v0.0.1
