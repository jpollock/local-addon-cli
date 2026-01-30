#!/usr/bin/env node

/**
 * Local CLI (lwp)
 *
 * Command-line interface for managing Local WordPress sites.
 * Connects to the Local addon's MCP server via HTTP.
 */

import { Command } from 'commander';
import ora from 'ora';
import { bootstrap, ConnectionInfo } from './bootstrap';
import { McpClient } from './client';
import {
  formatSiteList,
  formatSiteDetail,
  formatSuccess,
  formatError,
  getOutputFormat,
  FormatterOptions,
  SiteInfo,
} from './formatters';

const program = new Command();

// Store connection info globally after bootstrap
let client: McpClient | null = null;

/**
 * Ensure we're connected to the MCP server
 */
async function ensureConnected(options: FormatterOptions): Promise<McpClient> {
  if (client) {
    return client;
  }

  const spinner = options.quiet ? null : ora('Connecting to Local...').start();

  try {
    const result = await bootstrap({ verbose: false });

    if (!result.success || !result.connectionInfo) {
      spinner?.fail('Failed to connect');
      console.error(formatError(result.error || 'Unknown error'));
      process.exit(1);
    }

    spinner?.succeed('Connected to Local');
    client = new McpClient(result.connectionInfo);
    return client;
  } catch (error: any) {
    spinner?.fail('Failed to connect');
    console.error(formatError(error.message));
    process.exit(1);
  }
}

program
  .name('lwp')
  .description('Command-line interface for Local WordPress development')
  .version('0.1.0');

// Global options
program
  .option('--json', 'Output results as JSON')
  .option('--quiet', 'Minimal output (IDs/names only)')
  .option('--no-color', 'Disable colored output');

// Sites command group
const sites = program.command('sites').description('Manage WordPress sites');

sites
  .command('list')
  .description('List all WordPress sites')
  .option('--status <status>', 'Filter by status (running|stopped|all)', 'all')
  .action(async (cmdOptions) => {
    const globalOpts = program.opts() as FormatterOptions;
    const format = getOutputFormat(globalOpts);

    try {
      const mcpClient = await ensureConnected(globalOpts);
      const result = await mcpClient.callTool('list_sites', {});

      if (result.isError) {
        console.error(formatError(McpClient.getTextContent(result)));
        process.exit(1);
      }

      const data = McpClient.parseJsonContent<{ sites: SiteInfo[] }>(result);
      let sitesToShow = data.sites;

      // Filter by status if specified
      if (cmdOptions.status !== 'all') {
        sitesToShow = sitesToShow.filter((s) => s.status === cmdOptions.status);
      }

      console.log(formatSiteList(sitesToShow, format, { noColor: globalOpts.noColor }));
    } catch (error: any) {
      console.error(formatError(error.message));
      process.exit(1);
    }
  });

sites
  .command('get <site>')
  .description('Get detailed information about a site')
  .action(async (site) => {
    const globalOpts = program.opts() as FormatterOptions;
    const format = getOutputFormat(globalOpts);

    try {
      const mcpClient = await ensureConnected(globalOpts);
      const result = await mcpClient.callTool('get_site', { site });

      if (result.isError) {
        console.error(formatError(McpClient.getTextContent(result)));
        process.exit(1);
      }

      const data = McpClient.parseJsonContent<Record<string, unknown>>(result);
      console.log(formatSiteDetail(data, format, { noColor: globalOpts.noColor }));
    } catch (error: any) {
      console.error(formatError(error.message));
      process.exit(1);
    }
  });

sites
  .command('start <site>')
  .description('Start a site')
  .action(async (site) => {
    const globalOpts = program.opts() as FormatterOptions;
    const spinner = globalOpts.quiet ? null : ora(`Starting ${site}...`).start();

    try {
      const mcpClient = await ensureConnected(globalOpts);
      const result = await mcpClient.callTool('start_site', { site });

      if (result.isError) {
        spinner?.fail(`Failed to start ${site}`);
        console.error(formatError(McpClient.getTextContent(result)));
        process.exit(1);
      }

      spinner?.succeed(`Started ${site}`);

      if (globalOpts.json) {
        console.log(McpClient.getTextContent(result));
      }
    } catch (error: any) {
      spinner?.fail(`Failed to start ${site}`);
      console.error(formatError(error.message));
      process.exit(1);
    }
  });

sites
  .command('stop <site>')
  .description('Stop a site')
  .action(async (site) => {
    const globalOpts = program.opts() as FormatterOptions;
    const spinner = globalOpts.quiet ? null : ora(`Stopping ${site}...`).start();

    try {
      const mcpClient = await ensureConnected(globalOpts);
      const result = await mcpClient.callTool('stop_site', { site });

      if (result.isError) {
        spinner?.fail(`Failed to stop ${site}`);
        console.error(formatError(McpClient.getTextContent(result)));
        process.exit(1);
      }

      spinner?.succeed(`Stopped ${site}`);

      if (globalOpts.json) {
        console.log(McpClient.getTextContent(result));
      }
    } catch (error: any) {
      spinner?.fail(`Failed to stop ${site}`);
      console.error(formatError(error.message));
      process.exit(1);
    }
  });

sites
  .command('restart <site>')
  .description('Restart a site')
  .action(async (site) => {
    const globalOpts = program.opts() as FormatterOptions;
    const spinner = globalOpts.quiet ? null : ora(`Restarting ${site}...`).start();

    try {
      const mcpClient = await ensureConnected(globalOpts);
      const result = await mcpClient.callTool('restart_site', { site });

      if (result.isError) {
        spinner?.fail(`Failed to restart ${site}`);
        console.error(formatError(McpClient.getTextContent(result)));
        process.exit(1);
      }

      spinner?.succeed(`Restarted ${site}`);

      if (globalOpts.json) {
        console.log(McpClient.getTextContent(result));
      }
    } catch (error: any) {
      spinner?.fail(`Failed to restart ${site}`);
      console.error(formatError(error.message));
      process.exit(1);
    }
  });

sites
  .command('create <name>')
  .description('Create a new WordPress site')
  .option('--php <version>', 'PHP version (e.g., 8.2)')
  .option('--webserver <type>', 'Web server type (nginx|apache)', 'nginx')
  .action(async (name, cmdOptions) => {
    const globalOpts = program.opts() as FormatterOptions;
    const spinner = globalOpts.quiet ? null : ora(`Creating site "${name}"...`).start();

    try {
      const mcpClient = await ensureConnected(globalOpts);
      const args: Record<string, unknown> = { name };
      if (cmdOptions.php) args.phpVersion = cmdOptions.php;
      if (cmdOptions.webserver) args.webServer = cmdOptions.webserver;

      const result = await mcpClient.callTool('create_site', args);

      if (result.isError) {
        spinner?.fail(`Failed to create "${name}"`);
        console.error(formatError(McpClient.getTextContent(result)));
        process.exit(1);
      }

      spinner?.succeed(`Created site "${name}"`);

      if (globalOpts.json) {
        console.log(McpClient.getTextContent(result));
      }
    } catch (error: any) {
      spinner?.fail(`Failed to create "${name}"`);
      console.error(formatError(error.message));
      process.exit(1);
    }
  });

sites
  .command('delete <site>')
  .description('Delete a site')
  .option('--confirm', 'Confirm deletion (required)')
  .action(async (site, cmdOptions) => {
    const globalOpts = program.opts() as FormatterOptions;

    if (!cmdOptions.confirm) {
      console.error(formatError('Deletion requires --confirm flag to prevent accidents'));
      process.exit(1);
    }

    const spinner = globalOpts.quiet ? null : ora(`Deleting "${site}"...`).start();

    try {
      const mcpClient = await ensureConnected(globalOpts);
      const result = await mcpClient.callTool('delete_site', { site, confirm: true });

      if (result.isError) {
        spinner?.fail(`Failed to delete "${site}"`);
        console.error(formatError(McpClient.getTextContent(result)));
        process.exit(1);
      }

      spinner?.succeed(`Deleted "${site}"`);

      if (globalOpts.json) {
        console.log(McpClient.getTextContent(result));
      }
    } catch (error: any) {
      spinner?.fail(`Failed to delete "${site}"`);
      console.error(formatError(error.message));
      process.exit(1);
    }
  });

sites
  .command('clone <site> <new-name>')
  .description('Clone an existing site')
  .action(async (site, newName) => {
    const globalOpts = program.opts() as FormatterOptions;
    const spinner = globalOpts.quiet ? null : ora(`Cloning "${site}" to "${newName}"...`).start();

    try {
      const mcpClient = await ensureConnected(globalOpts);
      const result = await mcpClient.callTool('clone_site', { site, newName });

      if (result.isError) {
        spinner?.fail(`Failed to clone "${site}"`);
        console.error(formatError(McpClient.getTextContent(result)));
        process.exit(1);
      }

      spinner?.succeed(`Cloned "${site}" to "${newName}"`);

      if (globalOpts.json) {
        console.log(McpClient.getTextContent(result));
      }
    } catch (error: any) {
      spinner?.fail(`Failed to clone "${site}"`);
      console.error(formatError(error.message));
      process.exit(1);
    }
  });

sites
  .command('rename <site> <new-name>')
  .description('Rename a site')
  .action(async (site, newName) => {
    const globalOpts = program.opts() as FormatterOptions;
    const spinner = globalOpts.quiet ? null : ora(`Renaming "${site}" to "${newName}"...`).start();

    try {
      const mcpClient = await ensureConnected(globalOpts);
      const result = await mcpClient.callTool('rename_site', { site, newName });

      if (result.isError) {
        spinner?.fail(`Failed to rename "${site}"`);
        console.error(formatError(McpClient.getTextContent(result)));
        process.exit(1);
      }

      spinner?.succeed(`Renamed "${site}" to "${newName}"`);

      if (globalOpts.json) {
        console.log(McpClient.getTextContent(result));
      }
    } catch (error: any) {
      spinner?.fail(`Failed to rename "${site}"`);
      console.error(formatError(error.message));
      process.exit(1);
    }
  });

sites
  .command('open <site>')
  .description('Open site in browser')
  .action(async (site) => {
    const globalOpts = program.opts() as FormatterOptions;

    try {
      const mcpClient = await ensureConnected(globalOpts);
      const result = await mcpClient.callTool('open_site', { site });

      if (result.isError) {
        console.error(formatError(McpClient.getTextContent(result)));
        process.exit(1);
      }

      if (!globalOpts.quiet) {
        console.log(formatSuccess(`Opened ${site} in browser`));
      }
    } catch (error: any) {
      console.error(formatError(error.message));
      process.exit(1);
    }
  });

sites
  .command('export <site>')
  .description('Export site to a zip file')
  .option('--output <path>', 'Output file path')
  .action(async (site, cmdOptions) => {
    const globalOpts = program.opts() as FormatterOptions;
    const spinner = globalOpts.quiet ? null : ora(`Exporting "${site}"...`).start();

    try {
      const mcpClient = await ensureConnected(globalOpts);
      const args: Record<string, unknown> = { site };
      if (cmdOptions.output) args.outputPath = cmdOptions.output;

      const result = await mcpClient.callTool('export_site', args);

      if (result.isError) {
        spinner?.fail(`Failed to export "${site}"`);
        console.error(formatError(McpClient.getTextContent(result)));
        process.exit(1);
      }

      const text = McpClient.getTextContent(result);
      spinner?.succeed(`Exported "${site}"`);

      if (globalOpts.json) {
        console.log(text);
      } else if (!globalOpts.quiet) {
        console.log(text);
      }
    } catch (error: any) {
      spinner?.fail(`Failed to export "${site}"`);
      console.error(formatError(error.message));
      process.exit(1);
    }
  });

sites
  .command('import <zip-path>')
  .description('Import site from a zip file')
  .option('--name <name>', 'Site name (default: derived from zip)')
  .action(async (zipPath, cmdOptions) => {
    const globalOpts = program.opts() as FormatterOptions;
    const spinner = globalOpts.quiet ? null : ora(`Importing from "${zipPath}"...`).start();

    try {
      const mcpClient = await ensureConnected(globalOpts);
      const args: Record<string, unknown> = { zipPath };
      if (cmdOptions.name) args.name = cmdOptions.name;

      const result = await mcpClient.callTool('import_site', args);

      if (result.isError) {
        spinner?.fail('Failed to import site');
        console.error(formatError(McpClient.getTextContent(result)));
        process.exit(1);
      }

      spinner?.succeed('Imported site');

      if (globalOpts.json) {
        console.log(McpClient.getTextContent(result));
      }
    } catch (error: any) {
      spinner?.fail('Failed to import site');
      console.error(formatError(error.message));
      process.exit(1);
    }
  });

// Database command group
const db = program.command('db').description('Database operations');

db.command('export <site>')
  .description('Export database to SQL file')
  .option('--output <path>', 'Output file path')
  .action(async (site, cmdOptions) => {
    const globalOpts = program.opts() as FormatterOptions;
    const spinner = globalOpts.quiet ? null : ora(`Exporting database for "${site}"...`).start();

    try {
      const mcpClient = await ensureConnected(globalOpts);
      const args: Record<string, unknown> = { site };
      if (cmdOptions.output) args.outputPath = cmdOptions.output;

      const result = await mcpClient.callTool('export_database', args);

      if (result.isError) {
        spinner?.fail(`Failed to export database`);
        console.error(formatError(McpClient.getTextContent(result)));
        process.exit(1);
      }

      const text = McpClient.getTextContent(result);
      spinner?.succeed(`Exported database for "${site}"`);

      if (!globalOpts.quiet) {
        console.log(text);
      }
    } catch (error: any) {
      spinner?.fail(`Failed to export database`);
      console.error(formatError(error.message));
      process.exit(1);
    }
  });

db.command('import <site> <sql-file>')
  .description('Import SQL file into database')
  .action(async (site, sqlFile) => {
    const globalOpts = program.opts() as FormatterOptions;
    const spinner = globalOpts.quiet ? null : ora(`Importing database for "${site}"...`).start();

    try {
      const mcpClient = await ensureConnected(globalOpts);
      const result = await mcpClient.callTool('import_database', { site, sqlPath: sqlFile });

      if (result.isError) {
        spinner?.fail(`Failed to import database`);
        console.error(formatError(McpClient.getTextContent(result)));
        process.exit(1);
      }

      spinner?.succeed(`Imported database for "${site}"`);

      if (globalOpts.json) {
        console.log(McpClient.getTextContent(result));
      }
    } catch (error: any) {
      spinner?.fail(`Failed to import database`);
      console.error(formatError(error.message));
      process.exit(1);
    }
  });

db.command('adminer <site>')
  .description('Open Adminer database UI')
  .action(async (site) => {
    const globalOpts = program.opts() as FormatterOptions;

    try {
      const mcpClient = await ensureConnected(globalOpts);
      const result = await mcpClient.callTool('open_adminer', { site });

      if (result.isError) {
        console.error(formatError(McpClient.getTextContent(result)));
        process.exit(1);
      }

      if (!globalOpts.quiet) {
        console.log(formatSuccess(`Opened Adminer for ${site}`));
      }
    } catch (error: any) {
      console.error(formatError(error.message));
      process.exit(1);
    }
  });

// Dev command group
const dev = program.command('dev').description('Development tools');

dev
  .command('logs <site>')
  .description('Get site logs')
  .option('--type <type>', 'Log type (php|nginx|mysql|all)', 'all')
  .option('--lines <n>', 'Number of lines', '100')
  .action(async (site, cmdOptions) => {
    const globalOpts = program.opts() as FormatterOptions;

    try {
      const mcpClient = await ensureConnected(globalOpts);
      const result = await mcpClient.callTool('get_site_logs', {
        site,
        logType: cmdOptions.type,
        lines: parseInt(cmdOptions.lines, 10),
      });

      if (result.isError) {
        console.error(formatError(McpClient.getTextContent(result)));
        process.exit(1);
      }

      console.log(McpClient.getTextContent(result));
    } catch (error: any) {
      console.error(formatError(error.message));
      process.exit(1);
    }
  });

dev
  .command('xdebug <site>')
  .description('Toggle Xdebug')
  .option('--enable', 'Enable Xdebug')
  .option('--disable', 'Disable Xdebug')
  .action(async (site, cmdOptions) => {
    const globalOpts = program.opts() as FormatterOptions;

    if (!cmdOptions.enable && !cmdOptions.disable) {
      console.error(formatError('Specify --enable or --disable'));
      process.exit(1);
    }

    const enable = cmdOptions.enable === true;
    const spinner = globalOpts.quiet
      ? null
      : ora(`${enable ? 'Enabling' : 'Disabling'} Xdebug for "${site}"...`).start();

    try {
      const mcpClient = await ensureConnected(globalOpts);
      const result = await mcpClient.callTool('toggle_xdebug', { site, enable });

      if (result.isError) {
        spinner?.fail(`Failed to toggle Xdebug`);
        console.error(formatError(McpClient.getTextContent(result)));
        process.exit(1);
      }

      spinner?.succeed(`${enable ? 'Enabled' : 'Disabled'} Xdebug for "${site}"`);
    } catch (error: any) {
      spinner?.fail(`Failed to toggle Xdebug`);
      console.error(formatError(error.message));
      process.exit(1);
    }
  });

dev
  .command('ssl <site>')
  .description('Trust site SSL certificate')
  .option('--trust', 'Trust the certificate')
  .action(async (site, cmdOptions) => {
    const globalOpts = program.opts() as FormatterOptions;

    if (!cmdOptions.trust) {
      console.error(formatError('Specify --trust to trust the SSL certificate'));
      process.exit(1);
    }

    const spinner = globalOpts.quiet ? null : ora(`Trusting SSL for "${site}"...`).start();

    try {
      const mcpClient = await ensureConnected(globalOpts);
      const result = await mcpClient.callTool('trust_ssl', { site });

      if (result.isError) {
        spinner?.fail(`Failed to trust SSL`);
        console.error(formatError(McpClient.getTextContent(result)));
        process.exit(1);
      }

      spinner?.succeed(`Trusted SSL for "${site}"`);
    } catch (error: any) {
      spinner?.fail(`Failed to trust SSL`);
      console.error(formatError(error.message));
      process.exit(1);
    }
  });

dev
  .command('php <site>')
  .description('Change PHP version')
  .option('--version <version>', 'PHP version (e.g., 8.2.10)')
  .action(async (site, cmdOptions) => {
    const globalOpts = program.opts() as FormatterOptions;

    if (!cmdOptions.version) {
      console.error(formatError('Specify --version'));
      process.exit(1);
    }

    const spinner = globalOpts.quiet
      ? null
      : ora(`Changing PHP to ${cmdOptions.version} for "${site}"...`).start();

    try {
      const mcpClient = await ensureConnected(globalOpts);
      const result = await mcpClient.callTool('change_php_version', {
        site,
        version: cmdOptions.version,
      });

      if (result.isError) {
        spinner?.fail(`Failed to change PHP version`);
        console.error(formatError(McpClient.getTextContent(result)));
        process.exit(1);
      }

      spinner?.succeed(`Changed PHP to ${cmdOptions.version} for "${site}"`);
    } catch (error: any) {
      spinner?.fail(`Failed to change PHP version`);
      console.error(formatError(error.message));
      process.exit(1);
    }
  });

// Services command
program
  .command('services')
  .description('List available service versions')
  .option('--type <type>', 'Service type (php|database|webserver)')
  .action(async (cmdOptions) => {
    const globalOpts = program.opts() as FormatterOptions;
    const format = getOutputFormat(globalOpts);

    try {
      const mcpClient = await ensureConnected(globalOpts);
      const args: Record<string, unknown> = {};
      if (cmdOptions.type) args.serviceType = cmdOptions.type;

      const result = await mcpClient.callTool('list_services', args);

      if (result.isError) {
        console.error(formatError(McpClient.getTextContent(result)));
        process.exit(1);
      }

      if (format === 'json') {
        console.log(McpClient.getTextContent(result));
      } else {
        console.log(McpClient.getTextContent(result));
      }
    } catch (error: any) {
      console.error(formatError(error.message));
      process.exit(1);
    }
  });

// Blueprints command group
const blueprints = program.command('blueprints').description('Manage blueprints');

blueprints
  .command('list')
  .description('List available blueprints')
  .action(async () => {
    const globalOpts = program.opts() as FormatterOptions;
    const format = getOutputFormat(globalOpts);

    try {
      const mcpClient = await ensureConnected(globalOpts);
      const result = await mcpClient.callTool('list_blueprints', {});

      if (result.isError) {
        console.error(formatError(McpClient.getTextContent(result)));
        process.exit(1);
      }

      if (format === 'json') {
        console.log(McpClient.getTextContent(result));
      } else {
        console.log(McpClient.getTextContent(result));
      }
    } catch (error: any) {
      console.error(formatError(error.message));
      process.exit(1);
    }
  });

blueprints
  .command('save <site>')
  .description('Save site as blueprint')
  .option('--name <name>', 'Blueprint name')
  .action(async (site, cmdOptions) => {
    const globalOpts = program.opts() as FormatterOptions;
    const spinner = globalOpts.quiet ? null : ora(`Saving "${site}" as blueprint...`).start();

    try {
      const mcpClient = await ensureConnected(globalOpts);
      const args: Record<string, unknown> = { site };
      if (cmdOptions.name) args.name = cmdOptions.name;

      const result = await mcpClient.callTool('save_blueprint', args);

      if (result.isError) {
        spinner?.fail(`Failed to save blueprint`);
        console.error(formatError(McpClient.getTextContent(result)));
        process.exit(1);
      }

      spinner?.succeed(`Saved "${site}" as blueprint`);

      if (globalOpts.json) {
        console.log(McpClient.getTextContent(result));
      }
    } catch (error: any) {
      spinner?.fail(`Failed to save blueprint`);
      console.error(formatError(error.message));
      process.exit(1);
    }
  });

// WP-CLI command
program
  .command('wp <site> [args...]')
  .description('Run WP-CLI commands against a site')
  .action(async (site, args) => {
    const globalOpts = program.opts() as FormatterOptions;

    try {
      const mcpClient = await ensureConnected(globalOpts);
      const result = await mcpClient.callTool('wp_cli', {
        site,
        command: args,
      });

      if (result.isError) {
        console.error(formatError(McpClient.getTextContent(result)));
        process.exit(1);
      }

      console.log(McpClient.getTextContent(result));
    } catch (error: any) {
      console.error(formatError(error.message));
      process.exit(1);
    }
  });

// Info command
program
  .command('info')
  .description('Show Local application info')
  .action(async () => {
    const globalOpts = program.opts() as FormatterOptions;
    const format = getOutputFormat(globalOpts);

    try {
      const mcpClient = await ensureConnected(globalOpts);
      const result = await mcpClient.callTool('get_local_info', {});

      if (result.isError) {
        console.error(formatError(McpClient.getTextContent(result)));
        process.exit(1);
      }

      const data = McpClient.parseJsonContent<Record<string, unknown>>(result);
      console.log(formatSiteDetail(data, format, { noColor: globalOpts.noColor }));
    } catch (error: any) {
      console.error(formatError(error.message));
      process.exit(1);
    }
  });

// Parse and execute
program.parse();
