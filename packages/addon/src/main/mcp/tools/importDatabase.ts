/**
 * import_database Tool
 * Import SQL file into site database using WP-CLI
 */

import { McpToolDefinition, McpToolResult, LocalServices } from '../../../common/types';
import { validateRequiredParam, findSiteOrError, isValidSqlPath, createErrorResult } from './helpers';
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

  // Validate required parameters
  const siteError = validateRequiredParam(siteQuery, 'site');
  if (siteError) return siteError;

  const pathError = validateRequiredParam(sqlPath, 'sqlPath');
  if (pathError) return pathError;

  // Security: Validate path is safe (no path traversal attacks)
  if (!isValidSqlPath(sqlPath)) {
    return createErrorResult(
      'Error: Invalid SQL file path. Path must end in .sql and be within allowed directories (home, tmp).'
    );
  }

  // Verify file exists
  if (!fs.existsSync(sqlPath)) {
    return createErrorResult(`SQL file not found: ${sqlPath}`);
  }

  // Find site or return error
  const siteResult = findSiteOrError(siteQuery, services.siteData);
  if ('error' in siteResult) return siteResult.error;
  const { site } = siteResult;

  try {
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
