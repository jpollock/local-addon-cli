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
    const result = await bootstrap({
      verbose: false,
      onStatus: (status) => {
        if (spinner) spinner.text = status;
      },
    });

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

sites
  .command('create <name>')
  .description('Create a new WordPress site')
  .option('--php <version>', 'PHP version (e.g., 8.2.10)')
  .option('--web <server>', 'Web server (nginx|apache)')
  .option('--db <database>', 'Database (mysql|mariadb)')
  .option('--blueprint <name>', 'Use a blueprint')
  .option('--wp-user <username>', 'WordPress admin username', 'admin')
  .option('--wp-email <email>', 'WordPress admin email')
  .action(async (name, cmdOptions) => {
    const globalOpts = program.opts() as FormatterOptions;
    const spinner = globalOpts.quiet ? null : ora(`Creating "${name}"...`).start();

    try {
      const gql = await ensureConnected(globalOpts);

      const input: Record<string, unknown> = { name };
      if (cmdOptions.php) input.phpVersion = cmdOptions.php;
      if (cmdOptions.web) input.webServer = cmdOptions.web;
      if (cmdOptions.db) input.database = cmdOptions.db;
      if (cmdOptions.blueprint) input.blueprint = cmdOptions.blueprint;
      if (cmdOptions.wpUser) input.wpAdminUsername = cmdOptions.wpUser;
      if (cmdOptions.wpEmail) input.wpAdminEmail = cmdOptions.wpEmail;

      const data = await gql.mutate<{ createSite: { success: boolean; siteId: string; siteName: string; error: string | null } }>(`
        mutation($input: CreateSiteInput!) {
          createSite(input: $input) { success siteId siteName error }
        }
      `, { input });

      if (!data.createSite.success) {
        spinner?.fail('Create failed');
        console.error(formatError(data.createSite.error || 'Failed to create site'));
        process.exit(1);
      }

      spinner?.succeed(`Created "${data.createSite.siteName}" (${data.createSite.siteId})`);
    } catch (error: any) {
      spinner?.fail('Create failed');
      console.error(formatError(error.message));
      process.exit(1);
    }
  });

sites
  .command('delete <site>')
  .description('Delete a site')
  .option('-y, --yes', 'Skip confirmation')
  .option('--keep-files', 'Keep site files (only remove from Local)')
  .action(async (site, cmdOptions) => {
    const globalOpts = program.opts() as FormatterOptions;
    const spinner = globalOpts.quiet ? null : ora(`Deleting "${site}"...`).start();

    try {
      const gql = await ensureConnected(globalOpts);
      const siteId = await findSiteId(gql, site);

      const data = await gql.mutate<{ deleteSite: { success: boolean; error: string | null } }>(`
        mutation($input: DeleteSiteInput!) {
          deleteSite(input: $input) { success error }
        }
      `, { input: { id: siteId, trashFiles: !cmdOptions.keepFiles } });

      if (!data.deleteSite.success) {
        spinner?.fail('Delete failed');
        console.error(formatError(data.deleteSite.error || 'Failed to delete site'));
        process.exit(1);
      }

      spinner?.succeed(`Deleted "${site}"`);
    } catch (error: any) {
      spinner?.fail('Delete failed');
      console.error(formatError(error.message));
      process.exit(1);
    }
  });

sites
  .command('clone <site> <newName>')
  .description('Clone a site')
  .action(async (site, newName) => {
    const globalOpts = program.opts() as FormatterOptions;
    const spinner = globalOpts.quiet ? null : ora(`Cloning "${site}" to "${newName}"...`).start();

    try {
      const gql = await ensureConnected(globalOpts);
      const siteId = await findSiteId(gql, site);

      const data = await gql.mutate<{ cloneSite: { success: boolean; newSiteId: string; newSiteName: string; error: string | null } }>(`
        mutation($input: CloneSiteInput!) {
          cloneSite(input: $input) { success newSiteId newSiteName error }
        }
      `, { input: { siteId, newName } });

      if (!data.cloneSite.success) {
        spinner?.fail('Clone failed');
        console.error(formatError(data.cloneSite.error || 'Failed to clone site'));
        process.exit(1);
      }

      spinner?.succeed(`Cloned to "${data.cloneSite.newSiteName}" (${data.cloneSite.newSiteId})`);
    } catch (error: any) {
      spinner?.fail('Clone failed');
      console.error(formatError(error.message));
      process.exit(1);
    }
  });

sites
  .command('export <site>')
  .description('Export site to zip file')
  .option('-o, --output <path>', 'Output file path')
  .action(async (site, cmdOptions) => {
    const globalOpts = program.opts() as FormatterOptions;
    const spinner = globalOpts.quiet ? null : ora(`Exporting "${site}"...`).start();

    try {
      const gql = await ensureConnected(globalOpts);
      const siteId = await findSiteId(gql, site);

      const data = await gql.mutate<{ exportSite: { success: boolean; outputPath: string; error: string | null } }>(`
        mutation($input: ExportSiteInput!) {
          exportSite(input: $input) { success outputPath error }
        }
      `, { input: { siteId, outputPath: cmdOptions.output } });

      if (!data.exportSite.success) {
        spinner?.fail('Export failed');
        console.error(formatError(data.exportSite.error || 'Failed to export site'));
        process.exit(1);
      }

      spinner?.succeed(`Exported to ${data.exportSite.outputPath}`);
    } catch (error: any) {
      spinner?.fail('Export failed');
      console.error(formatError(error.message));
      process.exit(1);
    }
  });

sites
  .command('import <zipFile>')
  .description('Import site from zip file')
  .option('-n, --name <name>', 'Site name (defaults to zip filename)')
  .action(async (zipFile, cmdOptions) => {
    const globalOpts = program.opts() as FormatterOptions;
    const spinner = globalOpts.quiet ? null : ora(`Importing site...`).start();

    try {
      const gql = await ensureConnected(globalOpts);

      const data = await gql.mutate<{ importSite: { success: boolean; siteId: string; siteName: string; error: string | null } }>(`
        mutation($input: ImportSiteInput!) {
          importSite(input: $input) { success siteId siteName error }
        }
      `, { input: { zipPath: zipFile, siteName: cmdOptions.name } });

      if (!data.importSite.success) {
        spinner?.fail('Import failed');
        console.error(formatError(data.importSite.error || 'Failed to import site'));
        process.exit(1);
      }

      spinner?.succeed(`Imported "${data.importSite.siteName}" (${data.importSite.siteId})`);
    } catch (error: any) {
      spinner?.fail('Import failed');
      console.error(formatError(error.message));
      process.exit(1);
    }
  });

sites
  .command('rename <site> <newName>')
  .description('Rename a site')
  .action(async (site, newName) => {
    const globalOpts = program.opts() as FormatterOptions;
    const spinner = globalOpts.quiet ? null : ora(`Renaming "${site}" to "${newName}"...`).start();

    try {
      const gql = await ensureConnected(globalOpts);
      const siteId = await findSiteId(gql, site);

      const data = await gql.mutate<{ mcpRenameSite: { success: boolean; error: string | null } }>(`
        mutation($input: McpRenameSiteInput!) {
          mcpRenameSite(input: $input) { success error }
        }
      `, { input: { siteId, newName } });

      if (!data.mcpRenameSite.success) {
        spinner?.fail('Rename failed');
        console.error(formatError(data.mcpRenameSite.error || 'Failed to rename site'));
        process.exit(1);
      }

      spinner?.succeed(`Renamed to "${newName}"`);
    } catch (error: any) {
      spinner?.fail('Rename failed');
      console.error(formatError(error.message));
      process.exit(1);
    }
  });

sites
  .command('ssl <site>')
  .description('Trust SSL certificate for a site')
  .action(async (site) => {
    const globalOpts = program.opts() as FormatterOptions;
    const spinner = globalOpts.quiet ? null : ora(`Trusting SSL for "${site}"...`).start();

    try {
      const gql = await ensureConnected(globalOpts);
      const siteId = await findSiteId(gql, site);

      const data = await gql.mutate<{ trustSsl: { success: boolean; error: string | null } }>(`
        mutation($input: TrustSslInput!) {
          trustSsl(input: $input) { success error }
        }
      `, { input: { siteId } });

      if (!data.trustSsl.success) {
        spinner?.fail('Trust SSL failed');
        console.error(formatError(data.trustSsl.error || 'Failed to trust SSL'));
        process.exit(1);
      }

      spinner?.succeed(`SSL certificate trusted for "${site}"`);
    } catch (error: any) {
      spinner?.fail('Trust SSL failed');
      console.error(formatError(error.message));
      process.exit(1);
    }
  });

sites
  .command('php <site> <version>')
  .description('Change PHP version for a site')
  .action(async (site, version) => {
    const globalOpts = program.opts() as FormatterOptions;
    const spinner = globalOpts.quiet ? null : ora(`Changing PHP to ${version}...`).start();

    try {
      const gql = await ensureConnected(globalOpts);
      const siteId = await findSiteId(gql, site);

      const data = await gql.mutate<{ changePhpVersion: { success: boolean; error: string | null } }>(`
        mutation($input: ChangePhpVersionInput!) {
          changePhpVersion(input: $input) { success error }
        }
      `, { input: { siteId, phpVersion: version } });

      if (!data.changePhpVersion.success) {
        spinner?.fail('PHP change failed');
        console.error(formatError(data.changePhpVersion.error || 'Failed to change PHP version'));
        process.exit(1);
      }

      spinner?.succeed(`PHP version changed to ${version}`);
    } catch (error: any) {
      spinner?.fail('PHP change failed');
      console.error(formatError(error.message));
      process.exit(1);
    }
  });

sites
  .command('xdebug <site>')
  .description('Toggle Xdebug for a site')
  .option('--on', 'Enable Xdebug')
  .option('--off', 'Disable Xdebug')
  .action(async (site, cmdOptions) => {
    const globalOpts = program.opts() as FormatterOptions;
    const enabled = cmdOptions.on ? true : cmdOptions.off ? false : undefined;
    const action = enabled === undefined ? 'Toggling' : enabled ? 'Enabling' : 'Disabling';
    const spinner = globalOpts.quiet ? null : ora(`${action} Xdebug...`).start();

    try {
      const gql = await ensureConnected(globalOpts);
      const siteId = await findSiteId(gql, site);

      // If no flag specified, get current state and toggle
      let targetEnabled = enabled;
      if (targetEnabled === undefined) {
        const siteData = await gql.query<{ site: { xdebugEnabled: boolean } }>(`
          query($id: ID!) { site(id: $id) { xdebugEnabled } }
        `, { id: siteId });
        targetEnabled = !siteData.site.xdebugEnabled;
      }

      const data = await gql.mutate<{ toggleXdebug: { success: boolean; enabled: boolean; error: string | null } }>(`
        mutation($input: ToggleXdebugInput!) {
          toggleXdebug(input: $input) { success enabled error }
        }
      `, { input: { siteId, enabled: targetEnabled } });

      if (!data.toggleXdebug.success) {
        spinner?.fail('Xdebug toggle failed');
        console.error(formatError(data.toggleXdebug.error || 'Failed to toggle Xdebug'));
        process.exit(1);
      }

      spinner?.succeed(`Xdebug ${data.toggleXdebug.enabled ? 'enabled' : 'disabled'}`);
    } catch (error: any) {
      spinner?.fail('Xdebug toggle failed');
      console.error(formatError(error.message));
      process.exit(1);
    }
  });

sites
  .command('logs <site>')
  .description('Get site logs')
  .option('-t, --type <type>', 'Log type (php|nginx|mysql)', 'php')
  .option('-n, --lines <n>', 'Number of lines', '50')
  .action(async (site, cmdOptions) => {
    const globalOpts = program.opts() as FormatterOptions;
    const format = getOutputFormat(globalOpts);

    try {
      const gql = await ensureConnected(globalOpts);
      const siteId = await findSiteId(gql, site);

      const data = await gql.mutate<{ getSiteLogs: { success: boolean; logs: string[]; error: string | null } }>(`
        mutation($input: GetSiteLogsInput!) {
          getSiteLogs(input: $input) { success logs error }
        }
      `, { input: { siteId, logType: cmdOptions.type, lines: parseInt(cmdOptions.lines, 10) } });

      if (!data.getSiteLogs.success) {
        console.error(formatError(data.getSiteLogs.error || 'Failed to get logs'));
        process.exit(1);
      }

      if (format === 'json') {
        console.log(JSON.stringify(data.getSiteLogs.logs, null, 2));
      } else if (data.getSiteLogs.logs.length === 0) {
        console.log('No logs found.');
      } else {
        data.getSiteLogs.logs.forEach((line) => console.log(line));
      }
    } catch (error: any) {
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
      `, { input: { siteId, args } });

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

      const data = await gql.query<{ blueprints: { success: boolean; blueprints: Array<{ name: string }>; error: string | null } }>(`
        query {
          blueprints {
            success
            blueprints { name }
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

blueprints
  .command('save <site> <name>')
  .description('Save a site as a blueprint')
  .action(async (site, name) => {
    const globalOpts = program.opts() as FormatterOptions;
    const spinner = globalOpts.quiet ? null : ora(`Saving blueprint "${name}"...`).start();

    try {
      const gql = await ensureConnected(globalOpts);
      const siteId = await findSiteId(gql, site);

      const data = await gql.mutate<{ saveBlueprint: { success: boolean; error: string | null } }>(`
        mutation($input: SaveBlueprintInput!) {
          saveBlueprint(input: $input) { success error }
        }
      `, { input: { siteId, name } });

      if (!data.saveBlueprint.success) {
        spinner?.fail('Save failed');
        console.error(formatError(data.saveBlueprint.error || 'Failed to save blueprint'));
        process.exit(1);
      }

      spinner?.succeed(`Saved blueprint "${name}"`);
    } catch (error: any) {
      spinner?.fail('Save failed');
      console.error(formatError(error.message));
      process.exit(1);
    }
  });

// ===========================================
// Database Commands
// ===========================================

const db = program.command('db').description('Database operations');

db
  .command('export <site>')
  .description('Export database to SQL file')
  .option('-o, --output <path>', 'Output file path')
  .action(async (site, cmdOptions) => {
    const globalOpts = program.opts() as FormatterOptions;
    const spinner = globalOpts.quiet ? null : ora(`Exporting database...`).start();

    try {
      const gql = await ensureConnected(globalOpts);
      const siteId = await findSiteId(gql, site);

      const data = await gql.mutate<{ exportDatabase: { success: boolean; outputPath: string; error: string | null } }>(`
        mutation($input: ExportDatabaseInput!) {
          exportDatabase(input: $input) { success outputPath error }
        }
      `, { input: { siteId, outputPath: cmdOptions.output } });

      if (!data.exportDatabase.success) {
        spinner?.fail('Export failed');
        console.error(formatError(data.exportDatabase.error || 'Failed to export database'));
        process.exit(1);
      }

      spinner?.succeed(`Exported to ${data.exportDatabase.outputPath}`);
    } catch (error: any) {
      spinner?.fail('Export failed');
      console.error(formatError(error.message));
      process.exit(1);
    }
  });

db
  .command('import <site> <sqlFile>')
  .description('Import SQL file into database')
  .action(async (site, sqlFile) => {
    const globalOpts = program.opts() as FormatterOptions;
    const spinner = globalOpts.quiet ? null : ora(`Importing database...`).start();

    try {
      const gql = await ensureConnected(globalOpts);
      const siteId = await findSiteId(gql, site);

      const data = await gql.mutate<{ importDatabase: { success: boolean; error: string | null } }>(`
        mutation($input: ImportDatabaseInput!) {
          importDatabase(input: $input) { success error }
        }
      `, { input: { siteId, sqlPath: sqlFile } });

      if (!data.importDatabase.success) {
        spinner?.fail('Import failed');
        console.error(formatError(data.importDatabase.error || 'Failed to import database'));
        process.exit(1);
      }

      spinner?.succeed('Database imported successfully');
    } catch (error: any) {
      spinner?.fail('Import failed');
      console.error(formatError(error.message));
      process.exit(1);
    }
  });

db
  .command('adminer <site>')
  .description('Open Adminer database UI')
  .action(async (site) => {
    const globalOpts = program.opts() as FormatterOptions;
    const spinner = globalOpts.quiet ? null : ora(`Opening Adminer...`).start();

    try {
      const gql = await ensureConnected(globalOpts);
      const siteId = await findSiteId(gql, site);

      await gql.mutate(`
        mutation($input: OpenAdminerInput!) {
          openAdminer(input: $input) { success error }
        }
      `, { input: { siteId } });

      spinner?.succeed('Opened Adminer');
    } catch (error: any) {
      spinner?.fail('Failed to open Adminer');
      console.error(formatError(error.message));
      process.exit(1);
    }
  });

// ===========================================
// Backups Commands
// ===========================================

const backups = program.command('backups').description('Cloud backup operations');

backups
  .command('status')
  .description('Check backup service availability')
  .action(async () => {
    const globalOpts = program.opts() as FormatterOptions;
    const format = getOutputFormat(globalOpts);

    try {
      const gql = await ensureConnected(globalOpts);

      const data = await gql.query<{ backupStatus: { available: boolean; featureEnabled: boolean; dropbox: any; googleDrive: any } }>(`
        query {
          backupStatus {
            available
            featureEnabled
            dropbox { authenticated accountId email }
            googleDrive { authenticated accountId email }
          }
        }
      `);

      if (format === 'json') {
        console.log(JSON.stringify(data.backupStatus, null, 2));
      } else {
        const status = data.backupStatus;
        console.log(`\nBackup Status:`);
        console.log(`  Available: ${status.available ? 'Yes' : 'No'}`);
        console.log(`  Feature Enabled: ${status.featureEnabled ? 'Yes' : 'No'}`);
        if (status.dropbox) {
          console.log(`\n  Dropbox: ${status.dropbox.authenticated ? `Connected (${status.dropbox.email})` : 'Not connected'}`);
        }
        if (status.googleDrive) {
          console.log(`  Google Drive: ${status.googleDrive.authenticated ? `Connected (${status.googleDrive.email})` : 'Not connected'}`);
        }
      }
    } catch (error: any) {
      console.error(formatError(error.message));
      process.exit(1);
    }
  });

backups
  .command('list <site>')
  .description('List backups for a site')
  .option('-p, --provider <provider>', 'Backup provider (dropbox|googleDrive)', 'dropbox')
  .action(async (site, cmdOptions) => {
    const globalOpts = program.opts() as FormatterOptions;
    const format = getOutputFormat(globalOpts);

    try {
      const gql = await ensureConnected(globalOpts);
      const siteId = await findSiteId(gql, site);

      const data = await gql.query<{ listBackups: { success: boolean; backups: Array<{ snapshotId: string; timestamp: string; note: string }>; error: string | null } }>(`
        query($siteId: ID!, $provider: String!) {
          listBackups(siteId: $siteId, provider: $provider) {
            success
            backups { snapshotId timestamp note }
            error
          }
        }
      `, { siteId, provider: cmdOptions.provider });

      if (!data.listBackups.success) {
        console.error(formatError(data.listBackups.error || 'Failed to list backups'));
        process.exit(1);
      }

      if (format === 'json') {
        console.log(JSON.stringify(data.listBackups.backups, null, 2));
      } else if (data.listBackups.backups.length === 0) {
        console.log('No backups found.');
      } else {
        console.log(`\nBackups (${cmdOptions.provider}):`);
        for (const backup of data.listBackups.backups) {
          const date = new Date(backup.timestamp).toLocaleString();
          console.log(`  ${backup.snapshotId} - ${date}${backup.note ? ` - ${backup.note}` : ''}`);
        }
      }
    } catch (error: any) {
      console.error(formatError(error.message));
      process.exit(1);
    }
  });

backups
  .command('create <site>')
  .description('Create a backup')
  .option('-p, --provider <provider>', 'Backup provider (dropbox|googleDrive)', 'dropbox')
  .option('-n, --note <note>', 'Backup note')
  .action(async (site, cmdOptions) => {
    const globalOpts = program.opts() as FormatterOptions;
    const spinner = globalOpts.quiet ? null : ora(`Creating backup...`).start();

    try {
      const gql = await ensureConnected(globalOpts);
      const siteId = await findSiteId(gql, site);

      const data = await gql.mutate<{ createBackup: { success: boolean; snapshotId: string; error: string | null } }>(`
        mutation($siteId: ID!, $provider: String!, $note: String) {
          createBackup(siteId: $siteId, provider: $provider, note: $note) {
            success snapshotId error
          }
        }
      `, { siteId, provider: cmdOptions.provider, note: cmdOptions.note });

      if (!data.createBackup.success) {
        spinner?.fail('Backup failed');
        console.error(formatError(data.createBackup.error || 'Failed to create backup'));
        process.exit(1);
      }

      spinner?.succeed(`Backup created: ${data.createBackup.snapshotId}`);
    } catch (error: any) {
      spinner?.fail('Backup failed');
      console.error(formatError(error.message));
      process.exit(1);
    }
  });

backups
  .command('restore <site> <snapshotId>')
  .description('Restore from backup')
  .option('-p, --provider <provider>', 'Backup provider (dropbox|googleDrive)', 'dropbox')
  .option('-y, --yes', 'Skip confirmation')
  .action(async (site, snapshotId, cmdOptions) => {
    const globalOpts = program.opts() as FormatterOptions;
    const spinner = globalOpts.quiet ? null : ora(`Restoring backup...`).start();

    try {
      const gql = await ensureConnected(globalOpts);
      const siteId = await findSiteId(gql, site);

      const data = await gql.mutate<{ restoreBackup: { success: boolean; message: string; error: string | null } }>(`
        mutation($siteId: ID!, $provider: String!, $snapshotId: String!, $confirm: Boolean) {
          restoreBackup(siteId: $siteId, provider: $provider, snapshotId: $snapshotId, confirm: $confirm) {
            success message error
          }
        }
      `, { siteId, provider: cmdOptions.provider, snapshotId, confirm: cmdOptions.yes || false });

      if (!data.restoreBackup.success) {
        spinner?.fail('Restore failed');
        console.error(formatError(data.restoreBackup.error || 'Failed to restore backup'));
        process.exit(1);
      }

      spinner?.succeed(data.restoreBackup.message || 'Backup restored successfully');
    } catch (error: any) {
      spinner?.fail('Restore failed');
      console.error(formatError(error.message));
      process.exit(1);
    }
  });

backups
  .command('delete <site> <snapshotId>')
  .description('Delete a backup')
  .option('-p, --provider <provider>', 'Backup provider (dropbox|googleDrive)', 'dropbox')
  .option('-y, --yes', 'Skip confirmation')
  .action(async (site, snapshotId, cmdOptions) => {
    const globalOpts = program.opts() as FormatterOptions;
    const spinner = globalOpts.quiet ? null : ora(`Deleting backup...`).start();

    try {
      const gql = await ensureConnected(globalOpts);
      const siteId = await findSiteId(gql, site);

      const data = await gql.mutate<{ deleteBackup: { success: boolean; error: string | null } }>(`
        mutation($siteId: ID!, $provider: String!, $snapshotId: String!, $confirm: Boolean) {
          deleteBackup(siteId: $siteId, provider: $provider, snapshotId: $snapshotId, confirm: $confirm) {
            success error
          }
        }
      `, { siteId, provider: cmdOptions.provider, snapshotId, confirm: cmdOptions.yes || false });

      if (!data.deleteBackup.success) {
        spinner?.fail('Delete failed');
        console.error(formatError(data.deleteBackup.error || 'Failed to delete backup'));
        process.exit(1);
      }

      spinner?.succeed('Backup deleted');
    } catch (error: any) {
      spinner?.fail('Delete failed');
      console.error(formatError(error.message));
      process.exit(1);
    }
  });

// ===========================================
// WP Engine Commands
// ===========================================

const wpe = program.command('wpe').description('WP Engine sync operations');

wpe
  .command('status')
  .description('Check WP Engine authentication status')
  .action(async () => {
    const globalOpts = program.opts() as FormatterOptions;
    const format = getOutputFormat(globalOpts);

    try {
      const gql = await ensureConnected(globalOpts);

      const data = await gql.query<{ wpeStatus: { authenticated: boolean; email: string; accountId: string; accountName: string } }>(`
        query {
          wpeStatus {
            authenticated
            email
            accountId
            accountName
          }
        }
      `);

      if (format === 'json') {
        console.log(JSON.stringify(data.wpeStatus, null, 2));
      } else {
        const status = data.wpeStatus;
        if (status.authenticated) {
          console.log(`\nWP Engine: Connected`);
          console.log(`  Email: ${status.email}`);
          console.log(`  Account: ${status.accountName} (${status.accountId})`);
        } else {
          console.log(`\nWP Engine: Not connected`);
          console.log(`  Run 'lwp wpe login' to authenticate`);
        }
      }
    } catch (error: any) {
      console.error(formatError(error.message));
      process.exit(1);
    }
  });

wpe
  .command('login')
  .description('Authenticate with WP Engine')
  .action(async () => {
    const globalOpts = program.opts() as FormatterOptions;
    const spinner = globalOpts.quiet ? null : ora(`Opening WP Engine login...`).start();

    try {
      const gql = await ensureConnected(globalOpts);

      const data = await gql.mutate<{ wpeAuthenticate: { success: boolean; email: string; message: string; error: string | null } }>(`
        mutation {
          wpeAuthenticate { success email message error }
        }
      `);

      if (!data.wpeAuthenticate.success) {
        spinner?.fail('Authentication failed');
        console.error(formatError(data.wpeAuthenticate.error || 'Failed to authenticate'));
        process.exit(1);
      }

      spinner?.succeed(`Authenticated as ${data.wpeAuthenticate.email}`);
    } catch (error: any) {
      spinner?.fail('Authentication failed');
      console.error(formatError(error.message));
      process.exit(1);
    }
  });

wpe
  .command('logout')
  .description('Logout from WP Engine')
  .action(async () => {
    const globalOpts = program.opts() as FormatterOptions;
    const spinner = globalOpts.quiet ? null : ora(`Logging out...`).start();

    try {
      const gql = await ensureConnected(globalOpts);

      const data = await gql.mutate<{ wpeLogout: { success: boolean; error: string | null } }>(`
        mutation {
          wpeLogout { success error }
        }
      `);

      if (!data.wpeLogout.success) {
        spinner?.fail('Logout failed');
        console.error(formatError(data.wpeLogout.error || 'Failed to logout'));
        process.exit(1);
      }

      spinner?.succeed('Logged out from WP Engine');
    } catch (error: any) {
      spinner?.fail('Logout failed');
      console.error(formatError(error.message));
      process.exit(1);
    }
  });

wpe
  .command('sites')
  .description('List WP Engine sites')
  .action(async () => {
    const globalOpts = program.opts() as FormatterOptions;
    const format = getOutputFormat(globalOpts);

    try {
      const gql = await ensureConnected(globalOpts);

      const data = await gql.query<{ listWpeSites: { success: boolean; sites: Array<{ id: string; name: string; environment: string; primaryDomain: string }>; error: string | null } }>(`
        query {
          listWpeSites {
            success
            sites { id name environment primaryDomain }
            error
          }
        }
      `);

      if (!data.listWpeSites.success) {
        console.error(formatError(data.listWpeSites.error || 'Failed to list sites'));
        process.exit(1);
      }

      if (format === 'json') {
        console.log(JSON.stringify(data.listWpeSites.sites, null, 2));
      } else if (data.listWpeSites.sites.length === 0) {
        console.log('No WP Engine sites found.');
      } else {
        console.log('\nWP Engine Sites:');
        for (const site of data.listWpeSites.sites) {
          console.log(`  ${site.name} (${site.environment}) - ${site.primaryDomain}`);
        }
      }
    } catch (error: any) {
      console.error(formatError(error.message));
      process.exit(1);
    }
  });

wpe
  .command('link <site>')
  .description('Show WP Engine connection for a local site')
  .action(async (site) => {
    const globalOpts = program.opts() as FormatterOptions;
    const format = getOutputFormat(globalOpts);

    try {
      const gql = await ensureConnected(globalOpts);
      const siteId = await findSiteId(gql, site);

      const data = await gql.query<{ getWpeLink: { linked: boolean; siteName: string; connections: Array<{ remoteInstallId: string; installName: string; environment: string; primaryDomain: string }> } }>(`
        query($siteId: ID!) {
          getWpeLink(siteId: $siteId) {
            linked
            siteName
            connections { remoteInstallId installName environment primaryDomain }
          }
        }
      `, { siteId });

      if (format === 'json') {
        console.log(JSON.stringify(data.getWpeLink, null, 2));
      } else {
        const link = data.getWpeLink;
        if (!link.linked || link.connections.length === 0) {
          console.log(`\n"${link.siteName}" is not linked to WP Engine`);
        } else {
          console.log(`\n"${link.siteName}" WP Engine Connections:`);
          for (const conn of link.connections) {
            console.log(`  ${conn.installName} (${conn.environment}) - ${conn.primaryDomain}`);
            console.log(`    ID: ${conn.remoteInstallId}`);
          }
        }
      }
    } catch (error: any) {
      console.error(formatError(error.message));
      process.exit(1);
    }
  });

wpe
  .command('push <site>')
  .description('Push local site to WP Engine')
  .option('-r, --remote <installId>', 'Remote install ID')
  .option('--sql', 'Include database')
  .option('-y, --yes', 'Skip confirmation')
  .action(async (site, cmdOptions) => {
    const globalOpts = program.opts() as FormatterOptions;
    const spinner = globalOpts.quiet ? null : ora(`Pushing to WP Engine...`).start();

    try {
      const gql = await ensureConnected(globalOpts);
      const siteId = await findSiteId(gql, site);

      // Get remote install ID if not provided
      let remoteInstallId = cmdOptions.remote;
      if (!remoteInstallId) {
        const linkData = await gql.query<{ getWpeLink: { connections: Array<{ remoteInstallId: string }> } }>(`
          query($siteId: ID!) {
            getWpeLink(siteId: $siteId) {
              connections { remoteInstallId }
            }
          }
        `, { siteId });

        if (linkData.getWpeLink.connections.length === 0) {
          spinner?.fail('No WP Engine connection found');
          console.error(formatError('Site is not linked to WP Engine. Use --remote to specify install ID.'));
          process.exit(1);
        }
        remoteInstallId = linkData.getWpeLink.connections[0].remoteInstallId;
      }

      const data = await gql.mutate<{ pushToWpe: { success: boolean; message: string; error: string | null } }>(`
        mutation($localSiteId: ID!, $remoteInstallId: ID!, $includeSql: Boolean, $confirm: Boolean) {
          pushToWpe(localSiteId: $localSiteId, remoteInstallId: $remoteInstallId, includeSql: $includeSql, confirm: $confirm) {
            success message error
          }
        }
      `, { localSiteId: siteId, remoteInstallId, includeSql: cmdOptions.sql || false, confirm: cmdOptions.yes || false });

      if (!data.pushToWpe.success) {
        spinner?.fail('Push failed');
        console.error(formatError(data.pushToWpe.error || 'Failed to push to WP Engine'));
        process.exit(1);
      }

      spinner?.succeed(data.pushToWpe.message || 'Pushed to WP Engine');
    } catch (error: any) {
      spinner?.fail('Push failed');
      console.error(formatError(error.message));
      process.exit(1);
    }
  });

wpe
  .command('pull <site>')
  .description('Pull from WP Engine to local site')
  .option('-r, --remote <installId>', 'Remote install ID')
  .option('--sql', 'Include database')
  .action(async (site, cmdOptions) => {
    const globalOpts = program.opts() as FormatterOptions;
    const spinner = globalOpts.quiet ? null : ora(`Pulling from WP Engine...`).start();

    try {
      const gql = await ensureConnected(globalOpts);
      const siteId = await findSiteId(gql, site);

      // Get remote install ID if not provided
      let remoteInstallId = cmdOptions.remote;
      if (!remoteInstallId) {
        const linkData = await gql.query<{ getWpeLink: { connections: Array<{ remoteInstallId: string }> } }>(`
          query($siteId: ID!) {
            getWpeLink(siteId: $siteId) {
              connections { remoteInstallId }
            }
          }
        `, { siteId });

        if (linkData.getWpeLink.connections.length === 0) {
          spinner?.fail('No WP Engine connection found');
          console.error(formatError('Site is not linked to WP Engine. Use --remote to specify install ID.'));
          process.exit(1);
        }
        remoteInstallId = linkData.getWpeLink.connections[0].remoteInstallId;
      }

      const data = await gql.mutate<{ pullFromWpe: { success: boolean; message: string; error: string | null } }>(`
        mutation($localSiteId: ID!, $remoteInstallId: ID!, $includeSql: Boolean) {
          pullFromWpe(localSiteId: $localSiteId, remoteInstallId: $remoteInstallId, includeSql: $includeSql) {
            success message error
          }
        }
      `, { localSiteId: siteId, remoteInstallId, includeSql: cmdOptions.sql || false });

      if (!data.pullFromWpe.success) {
        spinner?.fail('Pull failed');
        console.error(formatError(data.pullFromWpe.error || 'Failed to pull from WP Engine'));
        process.exit(1);
      }

      spinner?.succeed(data.pullFromWpe.message || 'Pulled from WP Engine');
    } catch (error: any) {
      spinner?.fail('Pull failed');
      console.error(formatError(error.message));
      process.exit(1);
    }
  });

wpe
  .command('history <site>')
  .description('Show sync history for a site')
  .option('-l, --limit <n>', 'Number of events to show', '10')
  .action(async (site, cmdOptions) => {
    const globalOpts = program.opts() as FormatterOptions;
    const format = getOutputFormat(globalOpts);

    try {
      const gql = await ensureConnected(globalOpts);
      const siteId = await findSiteId(gql, site);

      const data = await gql.query<{ getSyncHistory: { success: boolean; events: Array<{ remoteInstallName: string; timestamp: string; direction: string; status: string }>; error: string | null } }>(`
        query($siteId: ID!, $limit: Int) {
          getSyncHistory(siteId: $siteId, limit: $limit) {
            success
            events { remoteInstallName timestamp direction status }
            error
          }
        }
      `, { siteId, limit: parseInt(cmdOptions.limit, 10) });

      if (!data.getSyncHistory.success) {
        console.error(formatError(data.getSyncHistory.error || 'Failed to get sync history'));
        process.exit(1);
      }

      if (format === 'json') {
        console.log(JSON.stringify(data.getSyncHistory.events, null, 2));
      } else if (data.getSyncHistory.events.length === 0) {
        console.log('No sync history found.');
      } else {
        console.log('\nSync History:');
        for (const event of data.getSyncHistory.events) {
          const date = new Date(event.timestamp).toLocaleString();
          const arrow = event.direction === 'push' ? '→' : '←';
          console.log(`  ${date} ${arrow} ${event.remoteInstallName} (${event.status})`);
        }
      }
    } catch (error: any) {
      console.error(formatError(error.message));
      process.exit(1);
    }
  });

wpe
  .command('diff <site>')
  .description('Show file changes between local and WP Engine')
  .option('-d, --direction <dir>', 'Direction (push|pull)', 'push')
  .action(async (site, cmdOptions) => {
    const globalOpts = program.opts() as FormatterOptions;
    const format = getOutputFormat(globalOpts);

    try {
      const gql = await ensureConnected(globalOpts);
      const siteId = await findSiteId(gql, site);

      const data = await gql.query<{ getSiteChanges: { success: boolean; added: Array<{ path: string }>; modified: Array<{ path: string }>; deleted: Array<{ path: string }>; totalChanges: number; error: string | null } }>(`
        query($siteId: ID!, $direction: String) {
          getSiteChanges(siteId: $siteId, direction: $direction) {
            success
            added { path }
            modified { path }
            deleted { path }
            totalChanges
            error
          }
        }
      `, { siteId, direction: cmdOptions.direction });

      if (!data.getSiteChanges.success) {
        console.error(formatError(data.getSiteChanges.error || 'Failed to get changes'));
        process.exit(1);
      }

      if (format === 'json') {
        console.log(JSON.stringify(data.getSiteChanges, null, 2));
      } else {
        const changes = data.getSiteChanges;
        console.log(`\nChanges to ${cmdOptions.direction} (${changes.totalChanges} total):`);

        if (changes.added.length > 0) {
          console.log('\n  Added:');
          changes.added.forEach((f) => console.log(`    + ${f.path}`));
        }
        if (changes.modified.length > 0) {
          console.log('\n  Modified:');
          changes.modified.forEach((f) => console.log(`    ~ ${f.path}`));
        }
        if (changes.deleted.length > 0) {
          console.log('\n  Deleted:');
          changes.deleted.forEach((f) => console.log(`    - ${f.path}`));
        }
        if (changes.totalChanges === 0) {
          console.log('  No changes detected.');
        }
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
