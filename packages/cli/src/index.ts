#!/usr/bin/env node

/**
 * Local CLI (lwp)
 *
 * Command-line interface for managing Local WordPress sites.
 * Connects directly to Local's GraphQL server.
 */

import { Command } from 'commander';
import ora from 'ora';
import { bootstrap, ConnectionInfo } from './bootstrap';
import { GraphQLClient } from './client';
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

// Store client globally after bootstrap
let client: GraphQLClient | null = null;

/**
 * Ensure we're connected to Local's GraphQL server
 */
async function ensureConnected(options: FormatterOptions): Promise<GraphQLClient> {
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
    client = new GraphQLClient(result.connectionInfo);
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

// ===========================================
// Sites Commands
// ===========================================

const sites = program.command('sites').description('Manage WordPress sites');

sites
  .command('list')
  .description('List all WordPress sites')
  .option('--status <status>', 'Filter by status (running|stopped|all)', 'all')
  .action(async (cmdOptions) => {
    const globalOpts = program.opts() as FormatterOptions;
    const format = getOutputFormat(globalOpts);

    try {
      const gql = await ensureConnected(globalOpts);
      const data = await gql.query<{ sites: Array<{ id: string; name: string; domain: string; status: string; path: string }> }>(`
        query {
          sites {
            id
            name
            domain
            status
            path
          }
        }
      `);

      let sitesToShow = data.sites.map((s) => ({
        id: s.id,
        name: s.name,
        domain: s.domain,
        status: s.status.toLowerCase(),
        path: s.path,
      }));

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
  .description('Get detailed info about a site')
  .action(async (site) => {
    const globalOpts = program.opts() as FormatterOptions;
    const format = getOutputFormat(globalOpts);

    try {
      const gql = await ensureConnected(globalOpts);

      // First find the site by name or ID
      const sitesData = await gql.query<{ sites: Array<{ id: string; name: string }> }>(`
        query { sites { id name } }
      `);

      const foundSite = sitesData.sites.find(
        (s) => s.id === site || s.name.toLowerCase().includes(site.toLowerCase())
      );

      if (!foundSite) {
        console.error(formatError(`Site not found: "${site}"`));
        process.exit(1);
      }

      const data = await gql.query<{ site: any }>(`
        query($id: ID!) {
          site(id: $id) {
            id
            name
            domain
            status
            path
            url
            host
            httpPort
            xdebugEnabled
            services {
              name
              version
              role
            }
            hostConnections {
              hostId
              remoteSiteId
            }
          }
        }
      `, { id: foundSite.id });

      console.log(formatSiteDetail(data.site, format, { noColor: globalOpts.noColor }));
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
    const spinner = globalOpts.quiet ? null : ora(`Starting "${site}"...`).start();

    try {
      const gql = await ensureConnected(globalOpts);
      const siteId = await findSiteId(gql, site);

      await gql.mutate(`
        mutation($id: ID!) {
          startSite(id: $id) { id status }
        }
      `, { id: siteId });

      spinner?.succeed(`Started "${site}"`);
    } catch (error: any) {
      spinner?.fail(`Failed to start "${site}"`);
      console.error(formatError(error.message));
      process.exit(1);
    }
  });

sites
  .command('stop <site>')
  .description('Stop a site')
  .action(async (site) => {
    const globalOpts = program.opts() as FormatterOptions;
    const spinner = globalOpts.quiet ? null : ora(`Stopping "${site}"...`).start();

    try {
      const gql = await ensureConnected(globalOpts);
      const siteId = await findSiteId(gql, site);

      await gql.mutate(`
        mutation($id: ID!) {
          stopSite(id: $id) { id status }
        }
      `, { id: siteId });

      spinner?.succeed(`Stopped "${site}"`);
    } catch (error: any) {
      spinner?.fail(`Failed to stop "${site}"`);
      console.error(formatError(error.message));
      process.exit(1);
    }
  });

sites
  .command('restart <site>')
  .description('Restart a site')
  .action(async (site) => {
    const globalOpts = program.opts() as FormatterOptions;
    const spinner = globalOpts.quiet ? null : ora(`Restarting "${site}"...`).start();

    try {
      const gql = await ensureConnected(globalOpts);
      const siteId = await findSiteId(gql, site);

      await gql.mutate(`
        mutation($id: ID!) {
          restartSite(id: $id) { id status }
        }
      `, { id: siteId });

      spinner?.succeed(`Restarted "${site}"`);
    } catch (error: any) {
      spinner?.fail(`Failed to restart "${site}"`);
      console.error(formatError(error.message));
      process.exit(1);
    }
  });

sites
  .command('open <site>')
  .description('Open site in browser')
  .option('--admin', 'Open WP Admin instead of frontend')
  .action(async (site, cmdOptions) => {
    const globalOpts = program.opts() as FormatterOptions;
    const spinner = globalOpts.quiet ? null : ora(`Opening "${site}"...`).start();

    try {
      const gql = await ensureConnected(globalOpts);
      const siteId = await findSiteId(gql, site);

      await gql.mutate(`
        mutation($input: OpenSiteInput!) {
          openSite(input: $input) { success error }
        }
      `, { input: { siteId, openAdmin: cmdOptions.admin || false } });

      spinner?.succeed(`Opened "${site}"`);
    } catch (error: any) {
      spinner?.fail(`Failed to open "${site}"`);
      console.error(formatError(error.message));
      process.exit(1);
    }
  });

// ===========================================
// WP-CLI Command
// ===========================================

program
  .command('wp <site> [args...]')
  .description('Run WP-CLI commands against a site')
  .action(async (site, args) => {
    const globalOpts = program.opts() as FormatterOptions;

    try {
      const gql = await ensureConnected(globalOpts);
      const siteId = await findSiteId(gql, site);

      const data = await gql.mutate<{ wpCli: { success: boolean; output: string; error: string | null } }>(`
        mutation($input: WpCliInput!) {
          wpCli(input: $input) { success output error }
        }
      `, { input: { siteId, command: args } });

      if (!data.wpCli.success) {
        console.error(formatError(data.wpCli.error || 'WP-CLI command failed'));
        process.exit(1);
      }

      console.log(data.wpCli.output);
    } catch (error: any) {
      console.error(formatError(error.message));
      process.exit(1);
    }
  });

// ===========================================
// Info Command
// ===========================================

program
  .command('info')
  .description('Show Local application info')
  .action(async () => {
    const globalOpts = program.opts() as FormatterOptions;
    const format = getOutputFormat(globalOpts);

    try {
      const gql = await ensureConnected(globalOpts);

      // Get sites count and basic info
      const data = await gql.query<{ sites: Array<{ id: string; status: string }> }>(`
        query { sites { id status } }
      `);

      const running = data.sites.filter((s) => s.status.toLowerCase() === 'running').length;
      const stopped = data.sites.filter((s) => s.status.toLowerCase() !== 'running').length;

      const info = {
        totalSites: data.sites.length,
        runningSites: running,
        stoppedSites: stopped,
        graphqlEndpoint: client?.['url'] || 'connected',
      };

      console.log(formatSiteDetail(info, format, { noColor: globalOpts.noColor }));
    } catch (error: any) {
      console.error(formatError(error.message));
      process.exit(1);
    }
  });

// ===========================================
// Services Command
// ===========================================

program
  .command('services')
  .description('List available service versions')
  .action(async () => {
    const globalOpts = program.opts() as FormatterOptions;
    const format = getOutputFormat(globalOpts);

    try {
      const gql = await ensureConnected(globalOpts);

      const data = await gql.query<{ listServices: { success: boolean; services: Array<{ role: string; name: string; version: string }>; error: string | null } }>(`
        query {
          listServices {
            success
            services { role name version }
            error
          }
        }
      `);

      if (!data.listServices.success) {
        console.error(formatError(data.listServices.error || 'Failed to list services'));
        process.exit(1);
      }

      if (format === 'json') {
        console.log(JSON.stringify(data.listServices.services, null, 2));
      } else {
        const grouped: Record<string, string[]> = {};
        for (const svc of data.listServices.services) {
          if (!grouped[svc.role]) grouped[svc.role] = [];
          grouped[svc.role].push(`${svc.version} (${svc.name})`);
        }

        for (const [role, versions] of Object.entries(grouped)) {
          console.log(`\n${role.charAt(0).toUpperCase() + role.slice(1)} Versions:`);
          versions.forEach((v) => console.log(`  - ${v}`));
        }
      }
    } catch (error: any) {
      console.error(formatError(error.message));
      process.exit(1);
    }
  });

// ===========================================
// Blueprints Command
// ===========================================

const blueprints = program.command('blueprints').description('Manage blueprints');

blueprints
  .command('list')
  .description('List available blueprints')
  .action(async () => {
    const globalOpts = program.opts() as FormatterOptions;
    const format = getOutputFormat(globalOpts);

    try {
      const gql = await ensureConnected(globalOpts);

      const data = await gql.query<{ blueprints: { success: boolean; blueprints: Array<{ name: string; path: string }>; error: string | null } }>(`
        query {
          blueprints {
            success
            blueprints { name path }
            error
          }
        }
      `);

      if (!data.blueprints.success) {
        console.error(formatError(data.blueprints.error || 'Failed to list blueprints'));
        process.exit(1);
      }

      if (format === 'json') {
        console.log(JSON.stringify(data.blueprints.blueprints, null, 2));
      } else if (data.blueprints.blueprints.length === 0) {
        console.log('No blueprints found.');
      } else {
        console.log('Blueprints:');
        data.blueprints.blueprints.forEach((b) => console.log(`  - ${b.name}`));
      }
    } catch (error: any) {
      console.error(formatError(error.message));
      process.exit(1);
    }
  });

// ===========================================
// Helper Functions
// ===========================================

/**
 * Find site ID by name or ID
 */
async function findSiteId(gql: GraphQLClient, siteQuery: string): Promise<string> {
  const data = await gql.query<{ sites: Array<{ id: string; name: string }> }>(`
    query { sites { id name } }
  `);

  const site = data.sites.find(
    (s) => s.id === siteQuery || s.name.toLowerCase().includes(siteQuery.toLowerCase())
  );

  if (!site) {
    throw new Error(`Site not found: "${siteQuery}"`);
  }

  return site.id;
}

// Parse and execute
program.parse();
