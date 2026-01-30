/**
 * import_database Tool
 * Import SQL file into site database using WP-CLI
 */

import { McpToolDefinition, McpToolResult, LocalServices } from '../../../common/types';
import { findSite } from './helpers';
import * as fs from 'fs';

export const importDatabaseDefinition: McpToolDefinition = {
  name: 'import_database',
  description: 'Import a SQL file into a site database',
  inputSchema: {
    type: 'object',
    properties: {
      site: {
        type: 'string',
        description: 'Site name or ID',
      },
      sqlPath: {
        type: 'string',
        description: 'Path to the SQL file to import',
      },
    },
    required: ['site', 'sqlPath'],
  },
};

interface ImportDatabaseArgs {
  site: string;
  sqlPath: string;
}

export async function importDatabase(
  args: Record<string, unknown>,
  services: LocalServices
): Promise<McpToolResult> {
  const { site: siteQuery, sqlPath } = args as unknown as ImportDatabaseArgs;

  if (!siteQuery) {
    return {
      content: [{ type: 'text', text: 'Error: site parameter is required' }],
      isError: true,
    };
  }

  if (!sqlPath) {
    return {
      content: [{ type: 'text', text: 'Error: sqlPath parameter is required' }],
      isError: true,
    };
  }

  try {
    // Verify file exists
    if (!fs.existsSync(sqlPath)) {
      return {
        content: [{ type: 'text', text: `SQL file not found: ${sqlPath}` }],
        isError: true,
      };
    }

    const site = findSite(siteQuery, services.siteData);

    if (!site) {
      const allSites = services.siteData.getSites();
      const siteNames = allSites.map((s: any) => s.name).join(', ');
      return {
        content: [
          {
            type: 'text',
            text: `Site not found: "${siteQuery}". Available sites: ${siteNames || 'none'}`,
          },
        ],
        isError: true,
      };
    }

    // Run WP-CLI db import
    const result = await services.wpCli.run(site, ['db', 'import', sqlPath]);

    if (result === null) {
      return {
        content: [{ type: 'text', text: `Failed to import database for "${site.name}"` }],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: `Successfully imported "${sqlPath}" into database for "${site.name}"`,
        },
      ],
    };
  } catch (error: any) {
    return {
      content: [{ type: 'text', text: `Failed to import database: ${error.message}` }],
      isError: true,
    };
  }
}
