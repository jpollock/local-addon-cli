# Local CLI

Command-line interface for [Local](https://localwp.com) WordPress development.

## Installation

```bash
npm install -g @local-labs-jpollock/local-cli
```

## Requirements

- [Local](https://localwp.com) must be running
- Node.js 18+

## Quick Start

```bash
# List all sites
lwp sites list

# Get site details
lwp sites get my-site

# Start/stop sites
lwp sites start my-site
lwp sites stop my-site

# Run WP-CLI commands
lwp wp my-site plugin list
lwp wp my-site theme status
```

## Commands

### Sites

```bash
lwp sites list                    # List all sites
lwp sites list --size             # Include disk usage
lwp sites list -s                 # Short form
lwp sites list --status running   # Filter by status
lwp sites get <site>              # Get site details
lwp sites start <site>      # Start a site
lwp sites stop <site>       # Stop a site
lwp sites create <name>     # Create a new site
lwp sites create <name> --blueprint <name>  # Create from blueprint
lwp sites delete <site>     # Delete a site
lwp sites open <site>       # Open site in browser
lwp sites open <site> --admin  # Open WP Admin
```

### WP-CLI

Run any WP-CLI command on a site:

```bash
lwp wp <site> <command>

# Examples
lwp wp my-site plugin list
lwp wp my-site user list
lwp wp my-site option get siteurl
lwp wp my-site db export backup.sql
```

### Blueprints

```bash
lwp blueprints list         # List available blueprints
lwp blueprints save <site> <name>  # Save site as blueprint
```

### Database

```bash
lwp db export <site>        # Export database
lwp db import <site> <file> # Import database
lwp db adminer <site>       # Open Adminer
```

### System

```bash
lwp info                    # Show Local app info
lwp update                  # Update CLI to latest version
lwp analytics show          # Show analytics status
lwp skill install           # Install Claude Code skill
```

## Global Options

```bash
--json      # Output as JSON
--quiet     # Minimal output
--no-color  # Disable colors
--help      # Show help
```

## Examples

### JSON Output for Scripting

```bash
# Get site IDs
lwp --json sites list | jq '.[].id'

# Check site status
lwp --json sites get my-site | jq '.status'

# List active plugins
lwp wp my-site plugin list --status=active --format=json
```

### Site Management

```bash
# Create site from blueprint
lwp sites create my-new-site --blueprint starter-theme

# Show disk usage
lwp sites list --size

# Bulk stop all sites
lwp --json sites list | jq -r '.[].name' | xargs -I {} lwp sites stop {}
```

## MCP Server

This package includes an MCP (Model Context Protocol) server for AI assistants:

```bash
# Run as MCP server (for AI tool integration)
npx @local-labs-jpollock/local-cli --mcp
```

## License

MIT
