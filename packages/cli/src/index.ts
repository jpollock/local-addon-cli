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
