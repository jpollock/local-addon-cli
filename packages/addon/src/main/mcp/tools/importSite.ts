/**
 * import_site Tool
 * Import a site from a zip file
 */

import { McpToolDefinition, McpToolResult, LocalServices } from '../../../common/types';
import { isValidFilePath } from './helpers';
import * as fs from 'fs';
import * as path from 'path';

export const importSiteDefinition: McpToolDefinition = {
  name: 'import_site',
  description: 'Import a WordPress site from a zip file (Local export, generic archive, or backup)',
  inputSchema: {
    type: 'object',
    properties: {
      zipPath: {
        type: 'string',
        description: 'Path to the zip file to import',
      },
      siteName: {
        type: 'string',
        description: 'Name for the imported site (optional, derived from zip if not provided)',
      },
    },
    required: ['zipPath'],
  },
};

interface ImportSiteArgs {
  zipPath: string;
  siteName?: string;
}

export async function importSite(
  args: Record<string, unknown>,
  services: LocalServices
): Promise<McpToolResult> {
  const { zipPath, siteName } = args as unknown as ImportSiteArgs;

  if (!zipPath) {
    return {
      content: [{ type: 'text', text: 'Error: zipPath parameter is required' }],
      isError: true,
    };
  }

  // Security: Validate path is safe (no path traversal attacks)
  if (!isValidFilePath(zipPath)) {
    return {
      content: [
        {
          type: 'text',
          text: 'Error: Invalid zip file path. Path must be within allowed directories (home, tmp).',
        },
      ],
      isError: true,
    };
  }

  try {
    // Verify file exists
    if (!fs.existsSync(zipPath)) {
      return {
        content: [{ type: 'text', text: `Zip file not found: ${zipPath}` }],
        isError: true,
      };
    }

    // Verify it's a zip file
    if (!zipPath.toLowerCase().endsWith('.zip')) {
      return {
        content: [{ type: 'text', text: 'Error: File must be a .zip archive' }],
        isError: true,
      };
    }

    // Check if importSite service exists
    if (!services.importSite) {
      return {
        content: [{ type: 'text', text: 'Import site service not available' }],
        isError: true,
      };
    }

    // Derive site name from zip filename if not provided
    const derivedName = siteName || path.basename(zipPath, '.zip').replace(/[^a-zA-Z0-9-_]/g, '-');

    // Import the site
    // The import service expects settings object
    const importSettings = {
      importType: 'localExport', // Default to Local export format
      zipPath: zipPath,
      siteName: derivedName,
    };

    const result = await services.importSite.run(importSettings);

    if (!result) {
      return {
        content: [{ type: 'text', text: 'Import completed but no result returned' }],
        isError: true,
      };
    }

    return {
      content: [
        {
          type: 'text',
          text: `Successfully imported site "${derivedName}" from ${path.basename(zipPath)}. Site ID: ${result.id || 'unknown'}`,
        },
      ],
    };
  } catch (error: any) {
    // Provide helpful error messages
    if (error.message?.includes('not a valid')) {
      return {
        content: [
          {
            type: 'text',
            text: `The zip file does not appear to be a valid Local export or WordPress backup. Error: ${error.message}`,
          },
        ],
        isError: true,
      };
    }
    return {
      content: [{ type: 'text', text: `Failed to import site: ${error.message}` }],
      isError: true,
    };
  }
}
