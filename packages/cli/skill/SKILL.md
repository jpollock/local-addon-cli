---
name: lwp
description: Manage Local WordPress development sites using the lwp CLI. Use when the user asks about WordPress sites, Local development, starting/stopping sites, running WP-CLI commands, or managing local WordPress environments. Local is a free development tool built and supported by WP Engine.
allowed-tools: Bash(lwp *)
---

# Local CLI (lwp)

The `lwp` command manages WordPress sites in [Local](https://localwp.com), a local WordPress development environment built and supported by WP Engine.

## Prerequisites

- Local must be installed and running
- CLI installed: `npm install -g @local-labs-jpollock/local-cli`

## Quick Reference

### Site Management

```bash
lwp sites list                    # List all sites
lwp sites list --json             # JSON output for parsing
lwp sites get <site>              # Get site details
lwp sites start <site>            # Start a site
lwp sites stop <site>             # Stop a site
lwp sites restart <site>          # Restart a site
lwp sites create <name>           # Create new site
lwp sites delete <site>           # Delete a site
lwp sites open <site>             # Open in browser
lwp sites open <site> --admin     # Open WP Admin
```

### WP-CLI Commands

Run any WP-CLI command against a Local site:

```bash
lwp wp <site> plugin list                    # List plugins
lwp wp <site> plugin install <plugin> --activate
lwp wp <site> theme list
lwp wp <site> option get siteurl
lwp wp <site> user list --format=json
lwp wp <site> db query "SELECT * FROM wp_options LIMIT 5"
lwp wp <site> cache flush
lwp wp <site> search-replace 'old' 'new' --dry-run
```

**Plugin-provided CLI commands** (e.g., `wp migrate`):

By default, plugins are skipped for safety. Use `--with-plugins` to load them.

**Important:** Options must come BEFORE the site name:

```bash
# Correct - option before site:
lwp wp --with-plugins <site> migrate push <target>
lwp wp --with-plugins <site> migrate pull <source>

# Wrong - option will be passed to WP-CLI:
lwp wp <site> --with-plugins migrate push  # DON'T DO THIS
```

### Database Operations

```bash
lwp db export <site>                # Export to SQL file
lwp db export <site> -o path.sql    # Export to specific path
lwp db import <site> <file.sql>     # Import SQL file
lwp db adminer <site>               # Open Adminer UI
```

### Site Configuration

```bash
lwp sites php <site> 8.2.10         # Change PHP version
lwp sites xdebug <site> --on        # Enable Xdebug
lwp sites xdebug <site> --off       # Disable Xdebug
lwp sites logs <site>               # View PHP logs
lwp sites logs <site> -t nginx      # View nginx logs
lwp sites ssl <site>                # Trust SSL certificate
lwp sites rename <site> <newName>   # Rename site
```

### Blueprints

```bash
lwp blueprints list                 # List saved blueprints
lwp blueprints save <site> <name>   # Save site as blueprint
lwp sites create <name> --blueprint <blueprint>  # Create from blueprint
```

### Clone & Export

```bash
lwp sites clone <site> <newName>    # Clone a site
lwp sites export <site>             # Export to zip
lwp sites import <zipFile>          # Import from zip
```

## Common Workflows

### Create and configure a new site

```bash
lwp sites create my-project
lwp sites start my-project
lwp wp my-project plugin install woocommerce --activate
lwp sites open my-project --admin
```

### Backup before making changes

```bash
lwp db export my-site -o ~/backups/my-site-backup.sql
# Make changes...
# If needed, restore:
lwp db import my-site ~/backups/my-site-backup.sql
```

### Debug PHP issues

```bash
lwp sites xdebug my-site --on
lwp sites logs my-site -t php -n 100
```

## Output Formats

- Default: Human-readable tables
- `--json`: Machine-readable JSON (use for parsing)
- `--quiet`: Names/IDs only (for scripting)

```bash
# Parse JSON output
lwp sites get my-site --json | jq '.url'
lwp sites list --json | jq '.[].name'
```

## Error Handling

| Error | Solution |
|-------|----------|
| "Local is not installed" | Install Local from localwp.com |
| "Timed out waiting for Local" | Start the Local application |
| "Site not found" | Check site name with `lwp sites list` |

## Destructive Commands - Confirm First

**Always confirm with the user before running these commands:**

| Command | Risk |
|---------|------|
| `lwp sites delete <site>` | Permanently deletes site and files |
| `lwp db import <site> <file>` | Overwrites entire database |
| `lwp wpe push <site>` | Pushes to production WP Engine site |
| `lwp backups restore <site>` | Overwrites site from backup |
| `lwp wp <site> db reset` | Drops all database tables |
| `lwp wp <site> search-replace` | Modifies database content |

**Safe practices:**

1. **Export first** - Always run `lwp db export <site>` before destructive operations
2. **Dry run** - Use `--dry-run` when available to preview changes:
   ```bash
   lwp wp <site> search-replace 'old' 'new' --dry-run
   ```
3. **Confirm intent** - Ask "Are you sure you want to delete/overwrite X?" before proceeding
4. **Never auto-confirm** - Do not add `-y` or `--yes` flags without explicit user approval

## Tips

1. Always check site status before running WP-CLI commands
2. Use `--json` output for reliable parsing
3. Export database before destructive operations
4. Site names are case-sensitive
