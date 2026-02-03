# Local CLI Usage Guide

Complete command reference for the Local CLI (`lwp`).

## Table of Contents

- [Installation](#installation)
- [Configuration](#configuration)
- [Site Management](#site-management)
- [WP-CLI Integration](#wp-cli-integration)
- [Database Operations](#database-operations)
- [Cloud Backups](#cloud-backups)
- [WP Engine Sync](#wp-engine-sync)
- [Blueprints](#blueprints)
- [Services](#services)
- [Global Options](#global-options)
- [Output Formats](#output-formats)
- [Error Handling](#error-handling)

## Installation

```bash
npm install -g @local-labs-jpollock/local-cli
```

After installation, the `lwp` command is available globally.

### Prerequisites

- [Local](https://localwp.com) must be installed
- Local must be running for most commands
- Node.js 18 or higher

### First Run

On first run, the CLI will:
1. Check if Local is installed
2. Install the CLI addon if needed
3. Activate the addon in Local
4. Restart Local if necessary

## Configuration

The CLI reads configuration from Local's data directory:

| Platform | Location |
|----------|----------|
| macOS | `~/Library/Application Support/Local/` |
| Windows | `%APPDATA%/Local/` |
| Linux | `~/.config/Local/` |

No additional configuration is required.

## Site Management

### List Sites

```bash
lwp sites list [options]

Options:
  --status <status>  Filter by status (running|stopped|all)
  -s, --size         Show disk size for each site
  --json             Output as JSON
  --quiet            Output site names only
```

**Examples:**
```bash
lwp sites list                    # Table format
lwp sites list --size             # Include disk usage
lwp sites list --status running   # Only running sites
lwp sites list --json             # JSON format
lwp sites list --quiet            # Just names
```

### Get Site Details

```bash
lwp sites get <site> [options]

Arguments:
  site        Site name or ID

Options:
  --json      Output as JSON
```

**Example:**
```bash
lwp sites get my-blog --json
```

### Start/Stop/Restart Site

```bash
lwp sites start <site>
lwp sites stop <site>
lwp sites restart <site>
```

**Examples:**
```bash
lwp sites start my-blog
lwp sites stop my-blog
lwp sites restart my-blog
```

### Create Site

```bash
lwp sites create <name> [options]

Arguments:
  name                 Site name

Options:
  --php <version>      PHP version (e.g., 8.2.10)
  --web <server>       Web server (nginx|apache)
  --db <database>      Database (mysql|mariadb)
  --blueprint <name>   Use a blueprint
  --wp-user <username> WordPress admin username (default: admin)
  --wp-email <email>   WordPress admin email
```

**Examples:**
```bash
lwp sites create my-new-site
lwp sites create my-site --php 8.2.10 --blueprint starter
```

### Delete Site

```bash
lwp sites delete <site> [options]

Options:
  -y, --yes           Skip confirmation
  --keep-files        Keep site files (only remove from Local)
```

**Example:**
```bash
lwp sites delete old-site --yes
```

### Clone Site

```bash
lwp sites clone <site> <newName>

Arguments:
  site        Source site name or ID
  newName     Name for the cloned site
```

**Example:**
```bash
lwp sites clone production-copy staging-test
```

### Export/Import Site

```bash
# Export
lwp sites export <site> [options]

Options:
  -o, --output <path>   Output file path

# Import
lwp sites import <zipFile> [options]

Options:
  -n, --name <name>     Site name (defaults to zip filename)
```

**Examples:**
```bash
lwp sites export my-blog -o ~/backups/my-blog.zip
lwp sites import ~/backups/my-blog.zip --name restored-blog
```

### Open Site

```bash
lwp sites open <site> [options]

Options:
  --admin     Open WP Admin instead of frontend
```

**Examples:**
```bash
lwp sites open my-blog
lwp sites open my-blog --admin
```

### SSL Certificate

```bash
lwp sites ssl <site>
```

Trusts the site's SSL certificate in the system keychain.

### PHP Version

```bash
lwp sites php <site> <version>

Arguments:
  site        Site name or ID
  version     PHP version (e.g., 8.2.10, 8.1.27)
```

**Example:**
```bash
lwp sites php my-blog 8.2.10
```

### Xdebug

```bash
lwp sites xdebug <site> [options]

Options:
  --on        Enable Xdebug
  --off       Disable Xdebug
```

Without flags, toggles the current state.

**Examples:**
```bash
lwp sites xdebug my-blog --on
lwp sites xdebug my-blog --off
lwp sites xdebug my-blog          # Toggle
```

### View Logs

```bash
lwp sites logs <site> [options]

Options:
  -t, --type <type>     Log type: php|nginx|mysql (default: php)
  -n, --lines <n>       Number of lines (default: 50)
```

**Examples:**
```bash
lwp sites logs my-blog
lwp sites logs my-blog -t nginx -n 100
```

### Rename Site

```bash
lwp sites rename <site> <newName>
```

**Example:**
```bash
lwp sites rename old-name new-name
```

## WP-CLI Integration

Run any WP-CLI command against a Local site:

```bash
lwp wp <site> <command...>

Arguments:
  site        Site name or ID
  command     WP-CLI command and arguments
```

**Examples:**
```bash
# Plugin management
lwp wp my-blog plugin list
lwp wp my-blog plugin install woocommerce --activate
lwp wp my-blog plugin update --all

# Theme management
lwp wp my-blog theme list
lwp wp my-blog theme activate twentytwentyfour

# Options
lwp wp my-blog option get siteurl
lwp wp my-blog option update blogname "My New Blog"

# Users
lwp wp my-blog user list --format=json
lwp wp my-blog user create editor editor@example.com --role=editor

# Database
lwp wp my-blog db query "SELECT * FROM wp_options LIMIT 5"

# Search-replace
lwp wp my-blog search-replace 'old-domain.com' 'new-domain.com' --dry-run

# Cache
lwp wp my-blog cache flush

# Cron
lwp wp my-blog cron event list
```

### Output Formats

WP-CLI supports various output formats via the `--format` flag:

```bash
lwp wp my-blog plugin list --format=json
lwp wp my-blog user list --format=csv
lwp wp my-blog option list --format=table
```

## Database Operations

### Export Database

```bash
lwp db export <site> [options]

Options:
  -o, --output <path>   Output file path (default: ~/Downloads)
```

**Examples:**
```bash
lwp db export my-blog
lwp db export my-blog -o ~/backups/my-blog.sql
```

### Import Database

```bash
lwp db import <site> <sqlFile>

Arguments:
  site        Site name or ID
  sqlFile     Path to SQL file
```

**Example:**
```bash
lwp db import my-blog ~/backups/my-blog.sql
```

### Open Adminer

```bash
lwp db adminer <site>
```

Opens the Adminer database UI in your browser.

## Cloud Backups

Cloud backups require Dropbox or Google Drive to be connected in Local.

### Backup Status

```bash
lwp backups status
```

Shows connection status for backup providers.

### List Backups

```bash
lwp backups list <site> [options]

Options:
  -p, --provider <provider>   Provider: dropbox|googleDrive (default: dropbox)
```

### Create Backup

```bash
lwp backups create <site> [options]

Options:
  -p, --provider <provider>   Provider: dropbox|googleDrive (default: dropbox)
  -n, --note <note>           Backup note/description
```

**Example:**
```bash
lwp backups create my-blog --note "Before major update"
```

### Restore Backup

```bash
lwp backups restore <site> <snapshotId> [options]

Options:
  -p, --provider <provider>   Provider: dropbox|googleDrive (default: dropbox)
  -y, --yes                   Skip confirmation
```

### Delete Backup

```bash
lwp backups delete <site> <snapshotId> [options]

Options:
  -p, --provider <provider>   Provider: dropbox|googleDrive (default: dropbox)
  -y, --yes                   Skip confirmation
```

## WP Engine Sync

Sync sites between Local and WP Engine.

### Authentication

```bash
lwp wpe login      # Opens browser for OAuth
lwp wpe logout     # Clear authentication
lwp wpe status     # Check auth status
```

### List WP Engine Sites

```bash
lwp wpe sites
```

### View Site Connection

```bash
lwp wpe link <site>
```

Shows which WP Engine install(s) a local site is connected to.

### Push to WP Engine

```bash
lwp wpe push <site> [options]

Options:
  -r, --remote <installId>    Remote install ID (auto-detected if linked)
  --sql                       Include database
  -y, --yes                   Skip confirmation
```

**Examples:**
```bash
lwp wpe push my-blog                    # Push files only
lwp wpe push my-blog --sql              # Include database
lwp wpe push my-blog -r abc123 --sql    # Specify remote
```

### Pull from WP Engine

```bash
lwp wpe pull <site> [options]

Options:
  -r, --remote <installId>    Remote install ID (auto-detected if linked)
  --sql                       Include database
```

### View Sync History

```bash
lwp wpe history <site> [options]

Options:
  -l, --limit <n>     Number of events (default: 10)
```

### View File Differences

```bash
lwp wpe diff <site> [options]

Options:
  -d, --direction <dir>   Direction: push|pull (default: push)
```

## Blueprints

Blueprints are saved site configurations for quick site creation.

### List Blueprints

```bash
lwp blueprints list
```

### Save Blueprint

```bash
lwp blueprints save <site> <name>

Arguments:
  site        Source site name or ID
  name        Blueprint name
```

**Example:**
```bash
lwp blueprints save my-starter starter-2024
```

## Services

View available Lightning Services (PHP, MySQL, nginx versions).

### List Services

```bash
lwp services list
```

### Service Info

```bash
lwp services info <service>

Arguments:
  service     Service name (php|mysql|nginx)
```

## System Commands

### Update CLI

```bash
lwp update [options]

Options:
  -c, --check     Check for updates without installing
```

**Example:**
```bash
lwp update              # Update to latest version
lwp update --check      # Just check for updates
```

### Analytics

Manage anonymous usage analytics.

```bash
lwp analytics show      # Show analytics status
lwp analytics enable    # Enable analytics
lwp analytics disable   # Disable analytics
lwp analytics reset     # Reset installation ID
```

### Claude Code Skill

Install the lwp skill for AI assistant integration.

```bash
lwp skill install       # Install skill to ~/.claude/skills/
```

### Local Info

```bash
lwp info                # Show Local app info
```

## Global Options

These options work with all commands:

| Option | Description |
|--------|-------------|
| `--json` | Output in JSON format (for scripting) |
| `--quiet` | Minimal output (IDs/names only) |
| `--no-color` | Disable colored output |
| `--help` | Show help for command |
| `--version` | Show CLI version |

## Output Formats

### Table (default)

Human-readable tables with headers and formatting.

```bash
lwp sites list
```

### JSON

Machine-readable JSON for scripting:

```bash
lwp sites list --json | jq '.[] | .name'
```

### Quiet

Minimal output for scripting:

```bash
for site in $(lwp sites list --quiet); do
  lwp sites stop $site
done
```

## Error Handling

### Common Errors

| Error | Cause | Solution |
|-------|-------|----------|
| "Local is not installed" | Local app not found | Install Local from localwp.com |
| "Timed out waiting for Local" | Local not running | Start Local application |
| "Site not found" | Invalid site name/ID | Check `lwp sites list` |
| "Not authenticated with WP Engine" | WPE auth required | Run `lwp wpe login` |

### Exit Codes

| Code | Meaning |
|------|---------|
| 0 | Success |
| 1 | Error (see stderr for details) |

### Debugging

For verbose output, check Local's logs:

- macOS: `~/Library/Logs/Local/`
- Windows: `%APPDATA%/Local/Logs/`
- Linux: `~/.config/Local/Logs/`
