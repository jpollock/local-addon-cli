# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

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

[Unreleased]: https://github.com/getflywheel/local-addon-cli/compare/v0.0.1...HEAD
[0.0.1]: https://github.com/getflywheel/local-addon-cli/releases/tag/v0.0.1
