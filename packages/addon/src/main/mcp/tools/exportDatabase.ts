/**
 * export_database Tool
 * Export site database to SQL file using WP-CLI
 */

import { McpToolDefinition, McpToolResult, LocalServices } from '../../../common/types';
import {
  validateRequiredParam,
  findSiteOrError,
  isValidFilePath,
  createErrorResult,
} from './helpers';

export const exportDatabaseDefinition: McpToolDefinition = {
  name: 'export_database',
  description: 'Export a site database to a SQL file',
  inputSchema: {
    type: 'object',
    properties: {
      site: {
        type: 'string',
        description: 'Site name or ID',
      },
      outputPath: {
        type: 'string',
        description: 'Output file path (optional, defaults to ~/Downloads/<site-name>.sql)',
      },
    },
    required: ['site'],
  },
};

interface ExportDatabaseArgs {
  site: string;
  outputPath?: string;
}

export async function exportDatabase(
  args: Record<string, unknown>,
  services: LocalServices
): Promise<McpToolResult> {
  const { site: siteQuery, outputPath } = args as unknown as ExportDatabaseArgs;

  // Validate required parameter
  const siteError = validateRequiredParam(siteQuery, 'site');
  if (siteError) return siteError;

  // Find site or return error
  const siteResult = findSiteOrError(siteQuery, services.siteData);
  if ('error' in siteResult) return siteResult.error;
  const { site } = siteResult;

  try {
    // Determine output path
    const homeDir = process.env.HOME || process.env.USERPROFILE || '';
    const defaultPath = `${homeDir}/Downloads/${site.name.replace(/[^a-zA-Z0-9-_]/g, '-')}.sql`;
    const finalPath = outputPath || defaultPath;

    // Security: Validate output path is safe (no path traversal attacks)
    if (!isValidFilePath(finalPath)) {
      return createErrorResult(
        'Error: Invalid output path. Path must be within allowed directories (home, tmp).'
      );
    }

    // Run WP-CLI db export
    const result = await services.wpCli.run(site, ['db', 'export', finalPath]);

    if (result === null) {
      return {
        content: [{ type: 'text', text: `Failed to export database for "${site.name}"` }],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: `Successfully exported database for "${site.name}" to: ${finalPath}`,
        },
      ],
    };
  } catch (error: any) {
    return {
      content: [{ type: 'text', text: `Failed to export database: ${error.message}` }],
      isError: true,
    };
  }
}
