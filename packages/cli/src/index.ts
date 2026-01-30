#!/usr/bin/env node

/**
 * Local CLI (lwp)
 *
 * Command-line interface for managing Local WordPress sites.
 * Connects to the Local addon's MCP server via HTTP.
 */

import { Command } from 'commander';

const program = new Command();

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
const sites = program
  .command('sites')
  .description('Manage WordPress sites');

sites
  .command('list')
  .description('List all WordPress sites')
  .option('--status <status>', 'Filter by status (running|stopped|all)', 'all')
  .action(async (options) => {
    console.log('TODO: Implement sites list');
    console.log('Options:', options);
  });

sites
  .command('get <site>')
  .description('Get detailed information about a site')
  .action(async (site) => {
    console.log(`TODO: Implement sites get for "${site}"`);
  });

sites
  .command('start <site>')
  .description('Start a site')
  .action(async (site) => {
    console.log(`TODO: Implement sites start for "${site}"`);
  });

sites
  .command('stop <site>')
  .description('Stop a site')
  .action(async (site) => {
    console.log(`TODO: Implement sites stop for "${site}"`);
  });

sites
  .command('restart <site>')
  .description('Restart a site')
  .action(async (site) => {
    console.log(`TODO: Implement sites restart for "${site}"`);
  });

// WP-CLI command
program
  .command('wp <site> [args...]')
  .description('Run WP-CLI commands against a site')
  .action(async (site, args) => {
    console.log(`TODO: Implement wp command for "${site}"`);
    console.log('Args:', args);
  });

// Info command
program
  .command('info')
  .description('Show Local application info')
  .action(async () => {
    console.log('TODO: Implement info command');
  });

// Parse and execute
program.parse();
