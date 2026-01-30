#!/usr/bin/env node
/**
 * Local MCP Server - stdio transport
 *
 * This script acts as an MCP server using stdio transport,
 * bridging to Local's GraphQL API for site management.
 */

const fs = require('fs');
const path = require('path');
const os = require('os');
const readline = require('readline');
const http = require('http');
const https = require('https');
const { URL } = require('url');

// Get Local's GraphQL connection info
function getGraphQLConnectionInfo() {
  const platform = os.platform();
  let configPath;

  switch (platform) {
    case 'darwin':
      configPath = path.join(os.homedir(), 'Library', 'Application Support', 'Local', 'graphql-connection-info.json');
      break;
    case 'win32':
      configPath = path.join(process.env.APPDATA || '', 'Local', 'graphql-connection-info.json');
      break;
    default:
      configPath = path.join(os.homedir(), '.config', 'Local', 'graphql-connection-info.json');
  }

  try {
    const content = fs.readFileSync(configPath, 'utf-8');
    return JSON.parse(content);
  } catch (err) {
    return null;
  }
}

// Make GraphQL request to Local (compatible with Node.js < 18)
async function graphqlRequest(query, variables = {}) {
  const info = getGraphQLConnectionInfo();
  if (!info) {
    throw new Error('Local is not running or GraphQL connection info not found');
  }

  const body = JSON.stringify({ query, variables });
  const url = new URL(info.url);
  const isHttps = url.protocol === 'https:';
  const httpModule = isHttps ? https : http;

  return new Promise((resolve, reject) => {
    const req = httpModule.request({
      hostname: url.hostname,
      port: url.port || (isHttps ? 443 : 80),
      path: url.pathname,
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Content-Length': Buffer.byteLength(body),
        'Authorization': `Bearer ${info.authToken}`,
      },
    }, (res) => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => {
        if (res.statusCode < 200 || res.statusCode >= 300) {
          reject(new Error(`GraphQL request failed: ${res.statusCode}`));
          return;
        }
        try {
          const result = JSON.parse(data);
          if (result.errors) {
            reject(new Error(result.errors[0].message));
            return;
          }
          resolve(result.data);
        } catch (err) {
          reject(new Error(`Failed to parse response: ${err.message}`));
        }
      });
    });

    req.on('error', reject);
    req.write(body);
    req.end();
  });
}

// Tool definitions
const tools = [
  {
    name: 'list_sites',
    description: 'List all WordPress sites in Local with their name, ID, status, and domain',
    inputSchema: {
      type: 'object',
      properties: {
        status: {
          type: 'string',
          enum: ['all', 'running', 'stopped'],
          description: 'Filter sites by status (default: all)',
        },
      },
    },
  },
  {
    name: 'get_site',
    description: 'Get detailed information about a WordPress site',
    inputSchema: {
      type: 'object',
      properties: {
        site: {
          type: 'string',
          description: 'Site name or ID',
        },
      },
      required: ['site'],
    },
  },
  {
    name: 'start_site',
    description: 'Start a WordPress site',
    inputSchema: {
      type: 'object',
      properties: {
        site: {
          type: 'string',
          description: 'Site name or ID',
        },
      },
      required: ['site'],
    },
  },
  {
    name: 'stop_site',
    description: 'Stop a running WordPress site',
    inputSchema: {
      type: 'object',
      properties: {
        site: {
          type: 'string',
          description: 'Site name or ID',
        },
      },
      required: ['site'],
    },
  },
  {
    name: 'restart_site',
    description: 'Restart a WordPress site (stops then starts it)',
    inputSchema: {
      type: 'object',
      properties: {
        site: {
          type: 'string',
          description: 'Site name or ID',
        },
      },
      required: ['site'],
    },
  },
  {
    name: 'wp_cli',
    description: 'Run a WP-CLI command against a WordPress site. Site will be auto-started if not running.',
    inputSchema: {
      type: 'object',
      properties: {
        site: {
          type: 'string',
          description: 'Site name or ID',
        },
        command: {
          type: 'array',
          items: { type: 'string' },
          description: 'WP-CLI command as array, e.g. ["plugin", "list", "--format=json"]',
        },
      },
      required: ['site', 'command'],
    },
  },
  {
    name: 'create_site',
    description: 'Create a new WordPress site in Local. The site will be created and started automatically. Optionally create from an existing blueprint.',
    inputSchema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: 'Site name (required)',
        },
        php_version: {
          type: 'string',
          description: 'PHP version (e.g., "8.2.10"). Uses Local default if not specified.',
        },
        blueprint: {
          type: 'string',
          description: 'Blueprint name to create the site from. Use list_blueprints to see available blueprints.',
        },
      },
      required: ['name'],
    },
  },
  {
    name: 'delete_site',
    description: 'Delete a WordPress site. Requires confirm=true as a safety measure.',
    inputSchema: {
      type: 'object',
      properties: {
        site: {
          type: 'string',
          description: 'Site name or ID',
        },
        confirm: {
          type: 'boolean',
          description: 'Must be true to confirm deletion',
        },
      },
      required: ['site', 'confirm'],
    },
  },
  {
    name: 'get_local_info',
    description: 'Get information about Local installation including version, platform, and available tools',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'open_site',
    description: 'Open a WordPress site in the default browser. Site will be auto-started if not running.',
    inputSchema: {
      type: 'object',
      properties: {
        site: {
          type: 'string',
          description: 'Site name or ID',
        },
        path: {
          type: 'string',
          description: 'Path to open (default: /, use /wp-admin for admin panel)',
        },
      },
      required: ['site'],
    },
  },
  {
    name: 'clone_site',
    description: 'Clone an existing WordPress site to create a copy with a new name',
    inputSchema: {
      type: 'object',
      properties: {
        site: {
          type: 'string',
          description: 'Site name or ID to clone',
        },
        new_name: {
          type: 'string',
          description: 'Name for the cloned site',
        },
      },
      required: ['site', 'new_name'],
    },
  },
  {
    name: 'export_site',
    description: 'Export a WordPress site to a zip file. Site will be auto-started if not running.',
    inputSchema: {
      type: 'object',
      properties: {
        site: {
          type: 'string',
          description: 'Site name or ID to export',
        },
        output_path: {
          type: 'string',
          description: 'Output directory path (default: ~/Downloads)',
        },
      },
      required: ['site'],
    },
  },
  {
    name: 'list_blueprints',
    description: 'List all available site blueprints (templates)',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'save_blueprint',
    description: 'Save a site as a blueprint (template) for creating new sites. Site will be auto-started if not running.',
    inputSchema: {
      type: 'object',
      properties: {
        site: {
          type: 'string',
          description: 'Site name or ID to save as blueprint',
        },
        name: {
          type: 'string',
          description: 'Name for the blueprint',
        },
      },
      required: ['site', 'name'],
    },
  },
  // Phase 8: WordPress Development Tools
  {
    name: 'export_database',
    description: 'Export a site database to a SQL file. Site will be auto-started if not running.',
    inputSchema: {
      type: 'object',
      properties: {
        site: {
          type: 'string',
          description: 'Site name or ID',
        },
        output_path: {
          type: 'string',
          description: 'Output file path (default: ~/Downloads/<site-name>.sql)',
        },
      },
      required: ['site'],
    },
  },
  {
    name: 'import_database',
    description: 'Import a SQL file into a site database. Site will be auto-started if not running.',
    inputSchema: {
      type: 'object',
      properties: {
        site: {
          type: 'string',
          description: 'Site name or ID',
        },
        sql_path: {
          type: 'string',
          description: 'Path to the SQL file to import',
        },
      },
      required: ['site', 'sql_path'],
    },
  },
  {
    name: 'open_adminer',
    description: 'Open Adminer database management UI for a site. Site will be auto-started if not running.',
    inputSchema: {
      type: 'object',
      properties: {
        site: {
          type: 'string',
          description: 'Site name or ID',
        },
      },
      required: ['site'],
    },
  },
  {
    name: 'trust_ssl',
    description: 'Trust the SSL certificate for a site (may require admin password)',
    inputSchema: {
      type: 'object',
      properties: {
        site: {
          type: 'string',
          description: 'Site name or ID',
        },
      },
      required: ['site'],
    },
  },
  {
    name: 'rename_site',
    description: 'Rename a WordPress site',
    inputSchema: {
      type: 'object',
      properties: {
        site: {
          type: 'string',
          description: 'Current site name or ID',
        },
        new_name: {
          type: 'string',
          description: 'New name for the site',
        },
      },
      required: ['site', 'new_name'],
    },
  },
  {
    name: 'change_php_version',
    description: 'Change the PHP version for a site',
    inputSchema: {
      type: 'object',
      properties: {
        site: {
          type: 'string',
          description: 'Site name or ID',
        },
        php_version: {
          type: 'string',
          description: 'Target PHP version (e.g., "8.2.10", "8.1.27")',
        },
      },
      required: ['site', 'php_version'],
    },
  },
  {
    name: 'import_site',
    description: 'Import a WordPress site from a zip file',
    inputSchema: {
      type: 'object',
      properties: {
        zip_path: {
          type: 'string',
          description: 'Path to the zip file to import',
        },
        site_name: {
          type: 'string',
          description: 'Name for the imported site (optional)',
        },
      },
      required: ['zip_path'],
    },
  },
  // Phase 9: Site Configuration & Dev Tools
  {
    name: 'toggle_xdebug',
    description: 'Enable or disable Xdebug for a site',
    inputSchema: {
      type: 'object',
      properties: {
        site: {
          type: 'string',
          description: 'Site name or ID',
        },
        enabled: {
          type: 'boolean',
          description: 'True to enable, false to disable',
        },
      },
      required: ['site', 'enabled'],
    },
  },
  {
    name: 'get_site_logs',
    description: 'Get log file contents for a site',
    inputSchema: {
      type: 'object',
      properties: {
        site: {
          type: 'string',
          description: 'Site name or ID',
        },
        log_type: {
          type: 'string',
          enum: ['php', 'nginx', 'mysql', 'all'],
          description: 'Type of logs to retrieve (default: php)',
        },
        lines: {
          type: 'number',
          description: 'Number of lines to return (default: 100)',
        },
      },
      required: ['site'],
    },
  },
  {
    name: 'list_services',
    description: 'List available service versions (PHP, MySQL, Nginx)',
    inputSchema: {
      type: 'object',
      properties: {
        type: {
          type: 'string',
          enum: ['php', 'database', 'webserver', 'all'],
          description: 'Filter by service type (default: all)',
        },
      },
    },
  },
  // Phase 10: Cloud Backups
  {
    name: 'backup_status',
    description: 'Check if cloud backups are available and authenticated. Shows Dropbox and Google Drive status.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'list_backups',
    description: 'List all cloud backups for a site from Dropbox or Google Drive',
    inputSchema: {
      type: 'object',
      properties: {
        site: {
          type: 'string',
          description: 'Site name or ID',
        },
        provider: {
          type: 'string',
          enum: ['dropbox', 'googleDrive'],
          description: 'Cloud storage provider',
        },
      },
      required: ['site', 'provider'],
    },
  },
  {
    name: 'create_backup',
    description: 'Create a backup of a site to cloud storage (Dropbox or Google Drive). Site will be auto-started if not running.',
    inputSchema: {
      type: 'object',
      properties: {
        site: {
          type: 'string',
          description: 'Site name or ID',
        },
        provider: {
          type: 'string',
          enum: ['dropbox', 'googleDrive'],
          description: 'Cloud storage provider',
        },
        note: {
          type: 'string',
          description: 'Optional note/description for the backup',
        },
      },
      required: ['site', 'provider'],
    },
  },
  {
    name: 'restore_backup',
    description: 'Restore a site from a cloud backup. Site will be auto-started if not running. WARNING: This will overwrite current site files and database.',
    inputSchema: {
      type: 'object',
      properties: {
        site: {
          type: 'string',
          description: 'Site name or ID',
        },
        provider: {
          type: 'string',
          enum: ['dropbox', 'googleDrive'],
          description: 'Cloud storage provider',
        },
        snapshot_id: {
          type: 'string',
          description: 'Snapshot ID to restore (from list_backups)',
        },
        confirm: {
          type: 'boolean',
          description: 'Must be true to confirm restoration',
        },
      },
      required: ['site', 'provider', 'snapshot_id', 'confirm'],
    },
  },
  {
    name: 'delete_backup',
    description: 'Delete a backup from cloud storage',
    inputSchema: {
      type: 'object',
      properties: {
        site: {
          type: 'string',
          description: 'Site name or ID',
        },
        provider: {
          type: 'string',
          enum: ['dropbox', 'googleDrive'],
          description: 'Cloud storage provider',
        },
        snapshot_id: {
          type: 'string',
          description: 'Snapshot ID to delete (from list_backups)',
        },
        confirm: {
          type: 'boolean',
          description: 'Must be true to confirm deletion',
        },
      },
      required: ['site', 'provider', 'snapshot_id', 'confirm'],
    },
  },
  {
    name: 'download_backup',
    description: 'Download a backup as a ZIP file to the Downloads folder',
    inputSchema: {
      type: 'object',
      properties: {
        site: {
          type: 'string',
          description: 'Site name or ID',
        },
        provider: {
          type: 'string',
          enum: ['dropbox', 'googleDrive'],
          description: 'Cloud storage provider',
        },
        snapshot_id: {
          type: 'string',
          description: 'Snapshot ID to download (from list_backups)',
        },
      },
      required: ['site', 'provider', 'snapshot_id'],
    },
  },
  {
    name: 'edit_backup_note',
    description: 'Update the note/description for a backup',
    inputSchema: {
      type: 'object',
      properties: {
        site: {
          type: 'string',
          description: 'Site name or ID',
        },
        provider: {
          type: 'string',
          enum: ['dropbox', 'googleDrive'],
          description: 'Cloud storage provider',
        },
        snapshot_id: {
          type: 'string',
          description: 'Snapshot ID to edit (from list_backups)',
        },
        note: {
          type: 'string',
          description: 'New note/description for the backup',
        },
      },
      required: ['site', 'provider', 'snapshot_id', 'note'],
    },
  },
  // Phase 11: WP Engine Connect
  {
    name: 'wpe_status',
    description: 'Check WP Engine authentication status',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'wpe_authenticate',
    description: 'Authenticate with WP Engine. Opens browser for OAuth login.',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'wpe_logout',
    description: 'Logout from WP Engine and clear stored credentials',
    inputSchema: {
      type: 'object',
      properties: {},
    },
  },
  {
    name: 'list_wpe_sites',
    description: 'List all sites from your WP Engine account. Requires authentication.',
    inputSchema: {
      type: 'object',
      properties: {
        account_id: {
          type: 'string',
          description: 'Filter by specific WP Engine account ID (optional)',
        },
      },
    },
  },
  // Phase 11b: Site Linking
  {
    name: 'get_wpe_link',
    description: 'Get WP Engine connection details for a local site. Shows if the site is linked to a WPE environment and sync capabilities.',
    inputSchema: {
      type: 'object',
      properties: {
        site: {
          type: 'string',
          description: 'Site name or ID',
        },
      },
      required: ['site'],
    },
  },
  // Phase 11c: Sync Operations
  {
    name: 'push_to_wpe',
    description: 'Push local site files and/or database to WP Engine. Site will be auto-started if not running. Requires confirm=true to prevent accidental overwrites.',
    inputSchema: {
      type: 'object',
      properties: {
        site: {
          type: 'string',
          description: 'Site name or ID',
        },
        include_database: {
          type: 'boolean',
          description: 'Include database in push (default: false)',
        },
        confirm: {
          type: 'boolean',
          description: 'Must be true to confirm push operation (required for safety)',
        },
      },
      required: ['site', 'confirm'],
    },
  },
  {
    name: 'pull_from_wpe',
    description: 'Pull files and/or database from WP Engine to local site. Site will be auto-started if not running. Requires confirm=true to prevent accidental overwrites.',
    inputSchema: {
      type: 'object',
      properties: {
        site: {
          type: 'string',
          description: 'Site name or ID',
        },
        include_database: {
          type: 'boolean',
          description: 'Include database in pull (default: false)',
        },
        confirm: {
          type: 'boolean',
          description: 'Must be true to confirm pull operation (required for safety)',
        },
      },
      required: ['site', 'confirm'],
    },
  },
  {
    name: 'get_sync_history',
    description: 'Get sync history (push/pull operations) for a local site.',
    inputSchema: {
      type: 'object',
      properties: {
        site: {
          type: 'string',
          description: 'Site name or ID',
        },
        limit: {
          type: 'number',
          description: 'Maximum number of history events to return (default: 10)',
        },
      },
      required: ['site'],
    },
  },
  {
    name: 'get_site_changes',
    description: 'Preview what files have changed between local site and WP Engine. Site will be auto-started if not running. Uses Magic Sync dry-run comparison.',
    inputSchema: {
      type: 'object',
      properties: {
        site: {
          type: 'string',
          description: 'Site name or ID',
        },
        direction: {
          type: 'string',
          enum: ['push', 'pull'],
          description: 'Direction of comparison: "push" shows local changes to upload, "pull" shows remote changes to download (default: push)',
        },
      },
      required: ['site'],
    },
  },
];

// Find site by name or ID
async function findSite(siteIdentifier) {
  const data = await graphqlRequest(`
    query {
      sites {
        id
        name
        status
        domain
      }
    }
  `);

  const sites = data.sites || [];
  const searchLower = siteIdentifier.toLowerCase();

  // Try exact ID match first
  let site = sites.find(s => s.id === siteIdentifier);
  if (site) return site;

  // Try exact name match
  site = sites.find(s => s.name.toLowerCase() === searchLower);
  if (site) return site;

  // Try partial name match
  site = sites.find(s => s.name.toLowerCase().includes(searchLower));
  if (site) return site;

  return null;
}

// Security: Validate snapshot ID format (restic uses hex hashes)
function isValidSnapshotId(snapshotId) {
  if (!snapshotId || typeof snapshotId !== 'string') return false;
  // Restic snapshot IDs are hex strings, 8-64 characters (short prefix or full hash)
  return /^[a-f0-9]{8,64}$/i.test(snapshotId);
}

// Security: Validate SQL file path
function isValidSqlPath(sqlPath) {
  if (!sqlPath || typeof sqlPath !== 'string') return false;
  const path = require('path');
  const fs = require('fs');
  const resolvedPath = path.resolve(sqlPath);
  // Check path doesn't contain traversal and ends with .sql
  return resolvedPath.endsWith('.sql') && !sqlPath.includes('..') && fs.existsSync(resolvedPath);
}

// Performance: Timeout wrapper for long-running operations
async function withTimeout(promise, timeoutMs, operationName) {
  let timeoutId;
  const timeoutPromise = new Promise((_, reject) => {
    timeoutId = setTimeout(() => {
      reject(new Error(`${operationName} timed out after ${timeoutMs / 1000} seconds`));
    }, timeoutMs);
  });

  try {
    const result = await Promise.race([promise, timeoutPromise]);
    clearTimeout(timeoutId);
    return result;
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

// Timeout constants (in milliseconds)
const TIMEOUT_SYNC_OPERATION = 300000; // 5 minutes for push/pull
const TIMEOUT_BACKUP_OPERATION = 600000; // 10 minutes for backup operations

// Helper: Sleep for specified milliseconds
function sleep(ms) {
  return new Promise(resolve => setTimeout(resolve, ms));
}

// Auto-start site if not running (used by tools that require a running site)
async function ensureSiteRunning(site) {
  // Check current status
  const data = await graphqlRequest(`
    query($id: ID!) {
      site(id: $id) {
        id
        status
      }
    }
  `, { id: site.id });

  const currentStatus = data.site?.status;

  if (currentStatus === 'running') {
    return { wasStarted: false };
  }

  // Start the site
  await graphqlRequest(`
    mutation($id: ID!) {
      startSite(id: $id) {
        id
        status
      }
    }
  `, { id: site.id });

  // Brief wait for services to be ready
  await sleep(2000);

  return { wasStarted: true };
}

// Tool handlers
async function handleTool(name, args) {
  switch (name) {
    case 'list_sites': {
      const data = await graphqlRequest(`
        query {
          sites {
            id
            name
            status
            domain
            hostConnections {
              hostId
              remoteSiteId
              remoteSiteEnv
              accountId
            }
          }
        }
      `);

      let sites = data.sites || [];

      if (args.status === 'running') {
        sites = sites.filter(s => s.status === 'running');
      } else if (args.status === 'stopped') {
        sites = sites.filter(s => s.status !== 'running');
      }

      // Transform hostConnections to wpeConnection for easier reading
      sites = sites.map(site => {
        const wpeConnection = site.hostConnections?.find(c => c.hostId === 'wpe');
        return {
          ...site,
          hostConnections: undefined, // Remove raw hostConnections
          wpeConnection: wpeConnection ? {
            remoteSiteId: wpeConnection.remoteSiteId,
            environment: wpeConnection.remoteSiteEnv || null,
            // Note: For full install name and capabilities, use get_wpe_link
            canPushPull: true, // All WPE-connected sites can push/pull
          } : null,
        };
      });

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ sites, count: sites.length }, null, 2),
        }],
      };
    }

    case 'get_site': {
      const site = await findSite(args.site);
      if (!site) {
        return {
          content: [{ type: 'text', text: `Site not found: ${args.site}` }],
          isError: true,
        };
      }
      return {
        content: [{ type: 'text', text: JSON.stringify(site, null, 2) }],
      };
    }

    case 'start_site': {
      const site = await findSite(args.site);
      if (!site) {
        return {
          content: [{ type: 'text', text: `Site not found: ${args.site}` }],
          isError: true,
        };
      }

      await graphqlRequest(`
        mutation($id: ID!) {
          startSite(id: $id) {
            id
            status
          }
        }
      `, { id: site.id });

      return {
        content: [{ type: 'text', text: `Started site: ${site.name}` }],
      };
    }

    case 'stop_site': {
      const site = await findSite(args.site);
      if (!site) {
        return {
          content: [{ type: 'text', text: `Site not found: ${args.site}` }],
          isError: true,
        };
      }

      await graphqlRequest(`
        mutation($id: ID!) {
          stopSite(id: $id) {
            id
            status
          }
        }
      `, { id: site.id });

      return {
        content: [{ type: 'text', text: `Stopped site: ${site.name}` }],
      };
    }

    case 'restart_site': {
      const site = await findSite(args.site);
      if (!site) {
        return {
          content: [{ type: 'text', text: `Site not found: ${args.site}` }],
          isError: true,
        };
      }

      await graphqlRequest(`
        mutation($id: ID!) {
          restartSite(id: $id) {
            id
            status
          }
        }
      `, { id: site.id });

      return {
        content: [{ type: 'text', text: `Restarted site: ${site.name}` }],
      };
    }

    case 'wp_cli': {
      // Security: Block dangerous WP-CLI commands that could execute arbitrary code
      const BLOCKED_WP_COMMANDS = [
        'eval',
        'eval-file',
        'shell',
        'db query',
        'db cli',
      ];

      const commandStr = (args.command || []).join(' ').toLowerCase();
      for (const blocked of BLOCKED_WP_COMMANDS) {
        if (commandStr.includes(blocked)) {
          return {
            content: [{ type: 'text', text: JSON.stringify({
              error: `Command '${blocked}' is blocked for security reasons. Use Local's terminal for shell access.`,
            }) }],
            isError: true,
          };
        }
      }

      const site = await findSite(args.site);
      if (!site) {
        return {
          content: [{ type: 'text', text: `Site not found: ${args.site}` }],
          isError: true,
        };
      }

      // Auto-start site if not running
      const { wasStarted } = await ensureSiteRunning(site);

      const data = await graphqlRequest(`
        mutation($input: WpCliInput!) {
          wpCli(input: $input) {
            success
            output
            error
          }
        }
      `, {
        input: {
          siteId: site.id,
          args: args.command,
        },
      });

      const result = data.wpCli;
      if (!result.success) {
        return {
          content: [{ type: 'text', text: `WP-CLI error: ${result.error}` }],
          isError: true,
        };
      }

      return {
        content: [{ type: 'text', text: result.output || 'Command completed successfully' }],
      };
    }

    case 'create_site': {
      if (!args.name) {
        return {
          content: [{ type: 'text', text: 'Error: name is required' }],
          isError: true,
        };
      }

      const input = {
        name: args.name,
      };

      if (args.php_version) {
        input.phpVersion = args.php_version;
      }

      if (args.blueprint) {
        input.blueprint = args.blueprint;
      }

      // Debug: log the input being sent
      console.error('[MCP stdio] create_site input:', JSON.stringify(input));
      console.error('[MCP stdio] args.blueprint value:', args.blueprint);

      const data = await graphqlRequest(`
        mutation($input: CreateSiteInput!) {
          createSite(input: $input) {
            success
            error
            siteId
            siteName
            siteDomain
          }
        }
      `, { input });

      const result = data.createSite;
      if (!result.success) {
        return {
          content: [{ type: 'text', text: `Failed to create site: ${result.error}` }],
          isError: true,
        };
      }

      const fromBlueprint = args.blueprint ? ` (from blueprint: ${args.blueprint})` : '';
      return {
        content: [{
          type: 'text',
          text: `Created site: ${result.siteName}${fromBlueprint}\nDomain: ${result.siteDomain}\nID: ${result.siteId}\nAdmin: admin / password\n\nThe site is being provisioned and will start automatically.`,
        }],
      };
    }

    case 'delete_site': {
      if (!args.confirm) {
        return {
          content: [{ type: 'text', text: 'Deletion not confirmed. Set confirm=true to delete the site.' }],
          isError: true,
        };
      }

      const site = await findSite(args.site);
      if (!site) {
        return {
          content: [{ type: 'text', text: `Site not found: ${args.site}` }],
          isError: true,
        };
      }

      await graphqlRequest(`
        mutation($input: DeleteSiteInput!) {
          deleteSite(input: $input) {
            success
            error
          }
        }
      `, {
        input: {
          id: site.id,
          trashFiles: true,
        },
      });

      return {
        content: [{ type: 'text', text: `Deleted site: ${site.name}` }],
      };
    }

    case 'get_local_info': {
      const data = await graphqlRequest(`
        query {
          sites {
            id
          }
        }
      `);

      const siteCount = data.sites?.length || 0;
      const platform = os.platform();
      const platformName = platform === 'darwin' ? 'macOS' : platform === 'win32' ? 'Windows' : 'Linux';

      const info = {
        mcpServerVersion: '1.0.0',
        platform: platformName,
        arch: os.arch(),
        siteCount: siteCount,
        availableTools: tools.map(t => t.name),
        transport: 'stdio',
      };

      return {
        content: [{ type: 'text', text: JSON.stringify(info, null, 2) }],
      };
    }

    case 'open_site': {
      const site = await findSite(args.site);
      if (!site) {
        return {
          content: [{ type: 'text', text: `Site not found: ${args.site}` }],
          isError: true,
        };
      }

      // Auto-start site if not running
      await ensureSiteRunning(site);

      const sitePath = args.path || '/';
      const data = await graphqlRequest(`
        mutation($input: OpenSiteInput!) {
          openSite(input: $input) {
            success
            error
            url
          }
        }
      `, {
        input: {
          siteId: site.id,
          path: sitePath,
        },
      });

      const result = data.openSite;
      if (!result.success) {
        return {
          content: [{ type: 'text', text: `Failed to open site: ${result.error}` }],
          isError: true,
        };
      }

      return {
        content: [{ type: 'text', text: `Opened ${site.name} in browser: ${result.url}` }],
      };
    }

    case 'clone_site': {
      const site = await findSite(args.site);
      if (!site) {
        return {
          content: [{ type: 'text', text: `Site not found: ${args.site}` }],
          isError: true,
        };
      }

      if (!args.new_name) {
        return {
          content: [{ type: 'text', text: 'Error: new_name is required' }],
          isError: true,
        };
      }

      const data = await graphqlRequest(`
        mutation($input: CloneSiteInput!) {
          cloneSite(input: $input) {
            success
            error
            newSiteId
            newSiteName
            newSiteDomain
          }
        }
      `, {
        input: {
          siteId: site.id,
          newName: args.new_name,
        },
      });

      const result = data.cloneSite;
      if (!result.success) {
        return {
          content: [{ type: 'text', text: `Failed to clone site: ${result.error}` }],
          isError: true,
        };
      }

      return {
        content: [{
          type: 'text',
          text: `Cloned ${site.name} to ${result.newSiteName}\nNew site ID: ${result.newSiteId}\nNew domain: ${result.newSiteDomain}`,
        }],
      };
    }

    case 'export_site': {
      const site = await findSite(args.site);
      if (!site) {
        return {
          content: [{ type: 'text', text: `Site not found: ${args.site}` }],
          isError: true,
        };
      }

      // Auto-start site if not running
      await ensureSiteRunning(site);

      const data = await graphqlRequest(`
        mutation($input: ExportSiteInput!) {
          exportSite(input: $input) {
            success
            error
            exportPath
          }
        }
      `, {
        input: {
          siteId: site.id,
          outputPath: args.output_path || null,
        },
      });

      const result = data.exportSite;
      if (!result.success) {
        return {
          content: [{ type: 'text', text: `Failed to export site: ${result.error}` }],
          isError: true,
        };
      }

      return {
        content: [{
          type: 'text',
          text: `Exported ${site.name} to:\n${result.exportPath}`,
        }],
      };
    }

    case 'list_blueprints': {
      const data = await graphqlRequest(`
        query {
          blueprints {
            success
            error
            blueprints {
              name
              lastModified
              phpVersion
              webServer
              database
            }
          }
        }
      `);

      const result = data.blueprints;
      if (!result.success) {
        return {
          content: [{ type: 'text', text: `Failed to list blueprints: ${result.error}` }],
          isError: true,
        };
      }

      if (!result.blueprints || result.blueprints.length === 0) {
        return {
          content: [{ type: 'text', text: 'No blueprints found. Use save_blueprint to create one from an existing site.' }],
        };
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ blueprints: result.blueprints, count: result.blueprints.length }, null, 2),
        }],
      };
    }

    case 'save_blueprint': {
      const site = await findSite(args.site);
      if (!site) {
        return {
          content: [{ type: 'text', text: `Site not found: ${args.site}` }],
          isError: true,
        };
      }

      if (!args.name) {
        return {
          content: [{ type: 'text', text: 'Error: name is required' }],
          isError: true,
        };
      }

      // Auto-start site if not running
      await ensureSiteRunning(site);

      const data = await graphqlRequest(`
        mutation($input: SaveBlueprintInput!) {
          saveBlueprint(input: $input) {
            success
            error
            blueprintName
          }
        }
      `, {
        input: {
          siteId: site.id,
          name: args.name,
        },
      });

      const result = data.saveBlueprint;
      if (!result.success) {
        return {
          content: [{ type: 'text', text: `Failed to save blueprint: ${result.error}` }],
          isError: true,
        };
      }

      return {
        content: [{
          type: 'text',
          text: `Saved ${site.name} as blueprint: ${result.blueprintName}\n\nYou can now create new sites from this blueprint.`,
        }],
      };
    }

    // Phase 8: WordPress Development Tools
    case 'export_database': {
      const site = await findSite(args.site);
      if (!site) {
        return {
          content: [{ type: 'text', text: `Site not found: ${args.site}` }],
          isError: true,
        };
      }

      // Auto-start site if not running
      await ensureSiteRunning(site);

      const data = await graphqlRequest(`
        mutation($input: ExportDatabaseInput!) {
          exportDatabase(input: $input) {
            success
            error
            outputPath
          }
        }
      `, {
        input: {
          siteId: site.id,
          outputPath: args.output_path || null,
        },
      });

      const result = data.exportDatabase;
      if (!result.success) {
        return {
          content: [{ type: 'text', text: `Failed to export database: ${result.error}` }],
          isError: true,
        };
      }

      return {
        content: [{
          type: 'text',
          text: `Exported database for ${site.name} to:\n${result.outputPath}`,
        }],
      };
    }

    case 'import_database': {
      const site = await findSite(args.site);
      if (!site) {
        return {
          content: [{ type: 'text', text: `Site not found: ${args.site}` }],
          isError: true,
        };
      }

      if (!args.sql_path) {
        return {
          content: [{ type: 'text', text: 'Error: sql_path is required' }],
          isError: true,
        };
      }

      // Security: Validate SQL path to prevent path traversal attacks
      if (!isValidSqlPath(args.sql_path)) {
        return {
          content: [{ type: 'text', text: 'Error: Invalid SQL path. Path must end with .sql, exist on disk, and not contain path traversal sequences (..).' }],
          isError: true,
        };
      }

      // Auto-start site if not running
      await ensureSiteRunning(site);

      const data = await graphqlRequest(`
        mutation($input: ImportDatabaseInput!) {
          importDatabase(input: $input) {
            success
            error
          }
        }
      `, {
        input: {
          siteId: site.id,
          sqlPath: args.sql_path,
        },
      });

      const result = data.importDatabase;
      if (!result.success) {
        return {
          content: [{ type: 'text', text: `Failed to import database: ${result.error}` }],
          isError: true,
        };
      }

      return {
        content: [{
          type: 'text',
          text: `Successfully imported database into ${site.name} from:\n${args.sql_path}`,
        }],
      };
    }

    case 'open_adminer': {
      const site = await findSite(args.site);
      if (!site) {
        return {
          content: [{ type: 'text', text: `Site not found: ${args.site}` }],
          isError: true,
        };
      }

      // Auto-start site if not running
      await ensureSiteRunning(site);

      const data = await graphqlRequest(`
        mutation($input: OpenAdminerInput!) {
          openAdminer(input: $input) {
            success
            error
          }
        }
      `, {
        input: {
          siteId: site.id,
        },
      });

      const result = data.openAdminer;
      if (!result.success) {
        return {
          content: [{ type: 'text', text: `Failed to open Adminer: ${result.error}` }],
          isError: true,
        };
      }

      return {
        content: [{
          type: 'text',
          text: `Opened Adminer for ${site.name}`,
        }],
      };
    }

    case 'trust_ssl': {
      const site = await findSite(args.site);
      if (!site) {
        return {
          content: [{ type: 'text', text: `Site not found: ${args.site}` }],
          isError: true,
        };
      }

      const data = await graphqlRequest(`
        mutation($input: TrustSslInput!) {
          trustSsl(input: $input) {
            success
            error
          }
        }
      `, {
        input: {
          siteId: site.id,
        },
      });

      const result = data.trustSsl;
      if (!result.success) {
        return {
          content: [{ type: 'text', text: `Failed to trust SSL: ${result.error}` }],
          isError: true,
        };
      }

      return {
        content: [{
          type: 'text',
          text: `Trusted SSL certificate for ${site.name}`,
        }],
      };
    }

    case 'rename_site': {
      const site = await findSite(args.site);
      if (!site) {
        return {
          content: [{ type: 'text', text: `Site not found: ${args.site}` }],
          isError: true,
        };
      }

      if (!args.new_name) {
        return {
          content: [{ type: 'text', text: 'Error: new_name is required' }],
          isError: true,
        };
      }

      const data = await graphqlRequest(`
        mutation($input: McpRenameSiteInput!) {
          mcpRenameSite(input: $input) {
            success
            error
            newName
          }
        }
      `, {
        input: {
          siteId: site.id,
          newName: args.new_name,
        },
      });

      const result = data.mcpRenameSite;
      if (!result.success) {
        return {
          content: [{ type: 'text', text: `Failed to rename site: ${result.error}` }],
          isError: true,
        };
      }

      return {
        content: [{
          type: 'text',
          text: `Renamed ${site.name} to ${result.newName}`,
        }],
      };
    }

    case 'change_php_version': {
      const site = await findSite(args.site);
      if (!site) {
        return {
          content: [{ type: 'text', text: `Site not found: ${args.site}` }],
          isError: true,
        };
      }

      if (!args.php_version) {
        return {
          content: [{ type: 'text', text: 'Error: php_version is required' }],
          isError: true,
        };
      }

      const data = await graphqlRequest(`
        mutation($input: ChangePhpVersionInput!) {
          changePhpVersion(input: $input) {
            success
            error
            phpVersion
          }
        }
      `, {
        input: {
          siteId: site.id,
          phpVersion: args.php_version,
        },
      });

      const result = data.changePhpVersion;
      if (!result.success) {
        return {
          content: [{ type: 'text', text: `Failed to change PHP version: ${result.error}` }],
          isError: true,
        };
      }

      return {
        content: [{
          type: 'text',
          text: `Changed PHP version for ${site.name} to ${result.phpVersion}`,
        }],
      };
    }

    case 'import_site': {
      if (!args.zip_path) {
        return {
          content: [{ type: 'text', text: 'Error: zip_path is required' }],
          isError: true,
        };
      }

      const data = await graphqlRequest(`
        mutation($input: ImportSiteInput!) {
          importSite(input: $input) {
            success
            error
            siteId
            siteName
          }
        }
      `, {
        input: {
          zipPath: args.zip_path,
          siteName: args.site_name || null,
        },
      });

      const result = data.importSite;
      if (!result.success) {
        return {
          content: [{ type: 'text', text: `Failed to import site: ${result.error}` }],
          isError: true,
        };
      }

      return {
        content: [{
          type: 'text',
          text: `Imported site: ${result.siteName}\nSite ID: ${result.siteId}`,
        }],
      };
    }

    // Phase 9: Site Configuration & Dev Tools
    case 'toggle_xdebug': {
      const site = await findSite(args.site);
      if (!site) {
        return {
          content: [{ type: 'text', text: `Site not found: ${args.site}` }],
          isError: true,
        };
      }

      if (typeof args.enabled !== 'boolean') {
        return {
          content: [{ type: 'text', text: 'Error: enabled must be true or false' }],
          isError: true,
        };
      }

      const data = await graphqlRequest(`
        mutation($input: ToggleXdebugInput!) {
          toggleXdebug(input: $input) {
            success
            error
            enabled
          }
        }
      `, {
        input: {
          siteId: site.id,
          enabled: args.enabled,
        },
      });

      const result = data.toggleXdebug;
      if (!result.success) {
        return {
          content: [{ type: 'text', text: `Failed to toggle Xdebug: ${result.error}` }],
          isError: true,
        };
      }

      return {
        content: [{
          type: 'text',
          text: `Xdebug ${result.enabled ? 'enabled' : 'disabled'} for ${site.name}`,
        }],
      };
    }

    case 'get_site_logs': {
      const site = await findSite(args.site);
      if (!site) {
        return {
          content: [{ type: 'text', text: `Site not found: ${args.site}` }],
          isError: true,
        };
      }

      const data = await graphqlRequest(`
        mutation($input: GetSiteLogsInput!) {
          getSiteLogs(input: $input) {
            success
            error
            logs {
              type
              content
              path
            }
          }
        }
      `, {
        input: {
          siteId: site.id,
          logType: args.log_type || 'php',
          lines: args.lines || 100,
        },
      });

      const result = data.getSiteLogs;
      if (!result.success) {
        return {
          content: [{ type: 'text', text: `Failed to get logs: ${result.error}` }],
          isError: true,
        };
      }

      let output = `Logs for ${site.name}:\n`;
      for (const log of result.logs) {
        output += `\n=== ${log.type.toUpperCase()} (${log.path}) ===\n${log.content}\n`;
      }

      return {
        content: [{ type: 'text', text: output }],
      };
    }

    case 'list_services': {
      const data = await graphqlRequest(`
        query($type: String) {
          listServices(type: $type) {
            success
            error
            services {
              role
              name
              version
            }
          }
        }
      `, {
        type: args.type || 'all',
      });

      const result = data.listServices;
      if (!result.success) {
        return {
          content: [{ type: 'text', text: `Failed to list services: ${result.error}` }],
          isError: true,
        };
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ services: result.services, count: result.services.length }, null, 2),
        }],
      };
    }

    // Phase 10: Cloud Backups
    case 'backup_status': {
      const data = await graphqlRequest(`
        query {
          backupStatus {
            available
            featureEnabled
            dropbox {
              authenticated
              accountId
              email
            }
            googleDrive {
              authenticated
              accountId
              email
            }
            message
            error
          }
        }
      `);

      const result = data.backupStatus;
      if (result.error) {
        return {
          content: [{ type: 'text', text: `Backup status check failed: ${result.error}` }],
          isError: true,
        };
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(result, null, 2),
        }],
      };
    }

    case 'list_backups': {
      const site = await findSite(args.site);
      if (!site) {
        return {
          content: [{ type: 'text', text: `Site not found: ${args.site}` }],
          isError: true,
        };
      }

      const data = await graphqlRequest(`
        query ListBackups($siteId: ID!, $provider: String!) {
          listBackups(siteId: $siteId, provider: $provider) {
            success
            siteName
            provider
            backups {
              snapshotId
              timestamp
              note
              siteDomain
              services
            }
            count
            error
          }
        }
      `, {
        siteId: site.id,
        provider: args.provider,
      });

      const result = data.listBackups;
      if (!result.success) {
        return {
          content: [{ type: 'text', text: `Failed to list backups: ${result.error}` }],
          isError: true,
        };
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            siteName: result.siteName,
            provider: result.provider,
            backups: result.backups,
            count: result.count,
          }, null, 2),
        }],
      };
    }

    case 'create_backup': {
      const site = await findSite(args.site);
      if (!site) {
        return {
          content: [{ type: 'text', text: `Site not found: ${args.site}` }],
          isError: true,
        };
      }

      // Auto-start site if not running
      await ensureSiteRunning(site);

      const data = await withTimeout(
        graphqlRequest(`
          mutation CreateBackup($siteId: ID!, $provider: String!, $note: String) {
            createBackup(siteId: $siteId, provider: $provider, note: $note) {
              success
              snapshotId
              timestamp
              message
              error
            }
          }
        `, {
          siteId: site.id,
          provider: args.provider,
          note: args.note,
        }),
        TIMEOUT_BACKUP_OPERATION,
        'Create backup'
      );

      const result = data.createBackup;
      if (!result.success) {
        return {
          content: [{ type: 'text', text: `Failed to create backup: ${result.error}` }],
          isError: true,
        };
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            snapshotId: result.snapshotId,
            timestamp: result.timestamp,
            message: result.message,
          }, null, 2),
        }],
      };
    }

    case 'restore_backup': {
      // Security: Validate snapshot ID format
      if (!isValidSnapshotId(args.snapshot_id)) {
        return {
          content: [{ type: 'text', text: JSON.stringify({
            error: 'Invalid snapshot ID format. Use list_backups to get valid snapshot IDs.',
          }) }],
          isError: true,
        };
      }

      const site = await findSite(args.site);
      if (!site) {
        return {
          content: [{ type: 'text', text: `Site not found: ${args.site}` }],
          isError: true,
        };
      }

      // Auto-start site if not running
      await ensureSiteRunning(site);

      const data = await withTimeout(
        graphqlRequest(`
          mutation RestoreBackup($siteId: ID!, $provider: String!, $snapshotId: String!, $confirm: Boolean) {
            restoreBackup(siteId: $siteId, provider: $provider, snapshotId: $snapshotId, confirm: $confirm) {
              success
              message
              error
            }
          }
        `, {
          siteId: site.id,
          provider: args.provider,
          snapshotId: args.snapshot_id,
          confirm: args.confirm === true,
        }),
        TIMEOUT_BACKUP_OPERATION,
        'Restore backup'
      );

      const result = data.restoreBackup;
      if (!result.success) {
        return {
          content: [{ type: 'text', text: `Failed to restore backup: ${result.error}` }],
          isError: true,
        };
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            message: result.message,
          }, null, 2),
        }],
      };
    }

    case 'delete_backup': {
      // Security: Validate snapshot ID format
      if (!isValidSnapshotId(args.snapshot_id)) {
        return {
          content: [{ type: 'text', text: JSON.stringify({
            error: 'Invalid snapshot ID format. Use list_backups to get valid snapshot IDs.',
          }) }],
          isError: true,
        };
      }

      const site = await findSite(args.site);
      if (!site) {
        return {
          content: [{ type: 'text', text: `Site not found: ${args.site}` }],
          isError: true,
        };
      }

      const data = await graphqlRequest(`
        mutation DeleteBackup($siteId: ID!, $provider: String!, $snapshotId: String!, $confirm: Boolean) {
          deleteBackup(siteId: $siteId, provider: $provider, snapshotId: $snapshotId, confirm: $confirm) {
            success
            deletedSnapshotId
            message
            error
          }
        }
      `, {
        siteId: site.id,
        provider: args.provider,
        snapshotId: args.snapshot_id,
        confirm: args.confirm === true,
      });

      const result = data.deleteBackup;
      if (!result.success) {
        return {
          content: [{ type: 'text', text: `Failed to delete backup: ${result.error}` }],
          isError: true,
        };
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            deletedSnapshotId: result.deletedSnapshotId,
            message: result.message,
          }, null, 2),
        }],
      };
    }

    case 'download_backup': {
      const site = await findSite(args.site);
      if (!site) {
        return {
          content: [{ type: 'text', text: `Site not found: ${args.site}` }],
          isError: true,
        };
      }

      // Security: Validate snapshot ID format
      if (!isValidSnapshotId(args.snapshot_id)) {
        return {
          content: [{ type: 'text', text: 'Error: Invalid snapshot ID format. Expected hex string (8-64 characters).' }],
          isError: true,
        };
      }

      const data = await graphqlRequest(`
        mutation DownloadBackup($siteId: ID!, $provider: String!, $snapshotId: String!) {
          downloadBackup(siteId: $siteId, provider: $provider, snapshotId: $snapshotId) {
            success
            filePath
            message
            error
          }
        }
      `, {
        siteId: site.id,
        provider: args.provider,
        snapshotId: args.snapshot_id,
      });

      const result = data.downloadBackup;
      if (!result.success) {
        return {
          content: [{ type: 'text', text: `Failed to download backup: ${result.error}` }],
          isError: true,
        };
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            filePath: result.filePath,
            message: result.message,
          }, null, 2),
        }],
      };
    }

    case 'edit_backup_note': {
      const site = await findSite(args.site);
      if (!site) {
        return {
          content: [{ type: 'text', text: `Site not found: ${args.site}` }],
          isError: true,
        };
      }

      const data = await graphqlRequest(`
        mutation EditBackupNote($siteId: ID!, $provider: String!, $snapshotId: String!, $note: String!) {
          editBackupNote(siteId: $siteId, provider: $provider, snapshotId: $snapshotId, note: $note) {
            success
            snapshotId
            note
            error
          }
        }
      `, {
        siteId: site.id,
        provider: args.provider,
        snapshotId: args.snapshot_id,
        note: args.note,
      });

      const result = data.editBackupNote;
      if (!result.success) {
        return {
          content: [{ type: 'text', text: `Failed to edit backup note: ${result.error}` }],
          isError: true,
        };
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            snapshotId: result.snapshotId,
            note: result.note,
          }, null, 2),
        }],
      };
    }

    // Phase 11: WP Engine Connect
    case 'wpe_status': {
      const data = await graphqlRequest(`
        query {
          wpeStatus {
            authenticated
            email
            accountId
            accountName
            tokenExpiry
            error
          }
        }
      `);

      const result = data.wpeStatus;
      if (result.error && !result.authenticated) {
        return {
          content: [{ type: 'text', text: `WP Engine status check failed: ${result.error}` }],
          isError: true,
        };
      }

      if (!result.authenticated) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              authenticated: false,
              message: 'Not authenticated with WP Engine. Use wpe_authenticate to login.',
            }, null, 2),
          }],
        };
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            authenticated: true,
            email: result.email,
            accountId: result.accountId,
            accountName: result.accountName,
            tokenExpiry: result.tokenExpiry,
          }, null, 2),
        }],
      };
    }

    case 'wpe_authenticate': {
      const data = await graphqlRequest(`
        mutation {
          wpeAuthenticate {
            success
            email
            message
            error
          }
        }
      `);

      const result = data.wpeAuthenticate;
      if (!result.success) {
        return {
          content: [{ type: 'text', text: `WP Engine authentication failed: ${result.error}` }],
          isError: true,
        };
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            email: result.email,
            message: result.message || 'Authentication initiated. Please complete the login in your browser.',
          }, null, 2),
        }],
      };
    }

    case 'wpe_logout': {
      const data = await graphqlRequest(`
        mutation {
          wpeLogout {
            success
            message
            error
          }
        }
      `);

      const result = data.wpeLogout;
      if (!result.success) {
        return {
          content: [{ type: 'text', text: `WP Engine logout failed: ${result.error}` }],
          isError: true,
        };
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            message: result.message || 'Logged out from WP Engine',
          }, null, 2),
        }],
      };
    }

    case 'list_wpe_sites': {
      const data = await graphqlRequest(`
        query($accountId: String) {
          listWpeSites(accountId: $accountId) {
            success
            error
            sites {
              id
              name
              environment
              phpVersion
              primaryDomain
              accountId
              accountName
              sftpHost
              sftpUser
            }
            count
          }
        }
      `, {
        accountId: args.account_id || null,
      });

      const result = data.listWpeSites;
      if (!result.success) {
        return {
          content: [{ type: 'text', text: `Failed to list WP Engine sites: ${result.error}` }],
          isError: true,
        };
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({ sites: result.sites, count: result.count }, null, 2),
        }],
      };
    }

    // Phase 11b: Site Linking
    case 'get_wpe_link': {
      const site = await findSite(args.site);
      if (!site) {
        return {
          content: [{ type: 'text', text: `Site not found: ${args.site}` }],
          isError: true,
        };
      }

      // Use the getWpeLink query which enriches with CAPI data
      const data = await graphqlRequest(`
        query($siteId: ID!) {
          getWpeLink(siteId: $siteId) {
            linked
            siteName
            connections {
              remoteInstallId
              installName
              environment
              accountId
              portalUrl
              primaryDomain
            }
            connectionCount
            capabilities {
              canPush
              canPull
              syncModes
              magicSyncAvailable
              databaseSyncAvailable
            }
            message
            error
          }
        }
      `, { siteId: site.id });

      const result = data.getWpeLink;
      if (result.error) {
        return {
          content: [{ type: 'text', text: `Failed to get WPE link: ${result.error}` }],
          isError: true,
        };
      }

      if (!result.linked) {
        return {
          content: [{
            type: 'text',
            text: JSON.stringify({
              linked: false,
              siteName: result.siteName,
              message: result.message || 'Site is not linked to any WP Engine environment.',
            }, null, 2),
          }],
        };
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            linked: true,
            siteName: result.siteName,
            connections: result.connections,
            connectionCount: result.connectionCount,
            capabilities: result.capabilities,
          }, null, 2),
        }],
      };
    }

    // Phase 11c: Sync Operations
    case 'push_to_wpe': {
      const site = await findSite(args.site);
      if (!site) {
        return {
          content: [{ type: 'text', text: `Site not found: ${args.site}` }],
          isError: true,
        };
      }

      // Auto-start site if not running
      await ensureSiteRunning(site);

      const data = await withTimeout(
        graphqlRequest(`
          mutation($localSiteId: ID!, $remoteInstallId: ID!, $includeSql: Boolean, $confirm: Boolean) {
            pushToWpe(localSiteId: $localSiteId, remoteInstallId: $remoteInstallId, includeSql: $includeSql, confirm: $confirm) {
              success
              message
              error
            }
          }
        `, {
          localSiteId: site.id,
          remoteInstallId: site.id, // Will be resolved by the mutation using hostConnections
          includeSql: args.include_database || false,
          confirm: args.confirm || false,
        }),
        TIMEOUT_SYNC_OPERATION,
        'Push to WP Engine'
      );

      const result = data.pushToWpe;
      if (!result.success) {
        return {
          content: [{ type: 'text', text: result.error || 'Push failed' }],
          isError: true,
        };
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            message: result.message,
          }, null, 2),
        }],
      };
    }

    case 'pull_from_wpe': {
      // Require confirmation for destructive operation
      if (!args.confirm) {
        return {
          content: [{ type: 'text', text: JSON.stringify({
            error: 'Pull requires confirm=true to prevent accidental overwrites. This operation will overwrite local files' + (args.include_database ? ' and database' : '') + '.',
          }) }],
          isError: true,
        };
      }

      const site = await findSite(args.site);
      if (!site) {
        return {
          content: [{ type: 'text', text: `Site not found: ${args.site}` }],
          isError: true,
        };
      }

      // Auto-start site if not running
      await ensureSiteRunning(site);

      const data = await withTimeout(
        graphqlRequest(`
          mutation($localSiteId: ID!, $remoteInstallId: ID!, $includeSql: Boolean, $confirm: Boolean) {
            pullFromWpe(localSiteId: $localSiteId, remoteInstallId: $remoteInstallId, includeSql: $includeSql, confirm: $confirm) {
              success
              message
              error
            }
          }
        `, {
          localSiteId: site.id,
          remoteInstallId: site.id, // Will be resolved by the mutation using hostConnections
          includeSql: args.include_database || false,
          confirm: args.confirm || false,
        }),
        TIMEOUT_SYNC_OPERATION,
        'Pull from WP Engine'
      );

      const result = data.pullFromWpe;
      if (!result.success) {
        return {
          content: [{ type: 'text', text: result.error || 'Pull failed' }],
          isError: true,
        };
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            success: true,
            message: result.message,
          }, null, 2),
        }],
      };
    }

    case 'get_sync_history': {
      const site = await findSite(args.site);
      if (!site) {
        return {
          content: [{ type: 'text', text: `Site not found: ${args.site}` }],
          isError: true,
        };
      }

      const data = await graphqlRequest(`
        query($siteId: ID!, $limit: Int) {
          getSyncHistory(siteId: $siteId, limit: $limit) {
            success
            siteName
            events {
              remoteInstallName
              timestamp
              environment
              direction
              status
            }
            count
            error
          }
        }
      `, {
        siteId: site.id,
        limit: args.limit || 10,
      });

      const result = data.getSyncHistory;
      if (!result.success) {
        return {
          content: [{ type: 'text', text: result.error || 'Failed to get sync history' }],
          isError: true,
        };
      }

      // Format events for readability
      const formattedEvents = result.events.map(e => ({
        ...e,
        timestamp: new Date(e.timestamp).toISOString(),
      }));

      return {
        content: [{
          type: 'text',
          text: JSON.stringify({
            siteName: result.siteName,
            events: formattedEvents,
            count: result.count,
          }, null, 2),
        }],
      };
    }

    case 'get_site_changes': {
      const site = await findSite(args.site);
      if (!site) {
        return {
          content: [{ type: 'text', text: `Site not found: ${args.site}` }],
          isError: true,
        };
      }

      // Auto-start site if not running
      await ensureSiteRunning(site);

      const data = await graphqlRequest(`
        query($siteId: ID!, $direction: String) {
          getSiteChanges(siteId: $siteId, direction: $direction) {
            success
            siteName
            direction
            added {
              path
              instruction
              size
              type
            }
            modified {
              path
              instruction
              size
              type
            }
            deleted {
              path
              instruction
              size
              type
            }
            totalChanges
            message
            error
          }
        }
      `, {
        siteId: site.id,
        direction: args.direction || 'push',
      });

      const result = data.getSiteChanges;
      if (!result.success) {
        return {
          content: [{ type: 'text', text: result.error || 'Failed to get site changes' }],
          isError: true,
        };
      }

      // Format output for readability
      const output = {
        siteName: result.siteName,
        direction: result.direction,
        summary: result.message,
        totalChanges: result.totalChanges,
      };

      // Only include non-empty arrays
      if (result.added.length > 0) {
        output.added = result.added.map(f => f.path);
      }
      if (result.modified.length > 0) {
        output.modified = result.modified.map(f => f.path);
      }
      if (result.deleted.length > 0) {
        output.deleted = result.deleted.map(f => f.path);
      }

      return {
        content: [{
          type: 'text',
          text: JSON.stringify(output, null, 2),
        }],
      };
    }

    default:
      return {
        content: [{ type: 'text', text: `Unknown tool: ${name}` }],
        isError: true,
      };
  }
}

// Process MCP messages
async function processMessage(message) {
  const { id, method, params } = message;

  switch (method) {
    case 'initialize':
      return {
        jsonrpc: '2.0',
        id,
        result: {
          protocolVersion: '2024-11-05',
          capabilities: { tools: {} },
          serverInfo: {
            name: 'local-mcp',
            version: '1.0.0',
          },
        },
      };

    case 'notifications/initialized':
      return null; // No response for notifications

    case 'tools/list':
      return {
        jsonrpc: '2.0',
        id,
        result: { tools },
      };

    case 'tools/call':
      try {
        const result = await handleTool(params.name, params.arguments || {});
        return {
          jsonrpc: '2.0',
          id,
          result,
        };
      } catch (err) {
        return {
          jsonrpc: '2.0',
          id,
          result: {
            content: [{ type: 'text', text: `Error: ${err.message}` }],
            isError: true,
          },
        };
      }

    case 'ping':
      return {
        jsonrpc: '2.0',
        id,
        result: {},
      };

    default:
      if (method?.startsWith('notifications/')) {
        return null;
      }
      return {
        jsonrpc: '2.0',
        id,
        error: {
          code: -32601,
          message: `Unknown method: ${method}`,
        },
      };
  }
}

// Main loop
const rl = readline.createInterface({
  input: process.stdin,
  terminal: false,
});

let pendingRequests = 0;
let closing = false;

function checkExit() {
  if (closing && pendingRequests === 0) {
    process.exit(0);
  }
}

rl.on('line', async (line) => {
  pendingRequests++;
  try {
    const message = JSON.parse(line);
    const response = await processMessage(message);

    if (response) {
      console.log(JSON.stringify(response));
    }
  } catch (err) {
    console.log(JSON.stringify({
      jsonrpc: '2.0',
      error: {
        code: -32700,
        message: `Parse error: ${err.message}`,
      },
    }));
  } finally {
    pendingRequests--;
    checkExit();
  }
});

rl.on('close', () => {
  closing = true;
  checkExit();
});
