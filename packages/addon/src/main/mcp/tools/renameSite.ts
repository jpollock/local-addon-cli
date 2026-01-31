/**
 * rename_site Tool
 * Rename a WordPress site
 */

import { McpToolDefinition, McpToolResult, LocalServices } from '../../../common/types';
import { validateRequiredParam, findSiteOrError, createErrorResult } from './helpers';

export const renameSiteDefinition: McpToolDefinition = {
  name: 'rename_site',
  description: 'Rename a WordPress site',
  inputSchema: {
    type: 'object',
    properties: {
      site: {
        type: 'string',
        description: 'Current site name or ID',
      },
      newName: {
        type: 'string',
        description: 'New name for the site',
      },
    },
    required: ['site', 'newName'],
  },
};

interface RenameSiteArgs {
  site: string;
  newName: string;
}

export async function renameSite(
  args: Record<string, unknown>,
  services: LocalServices
): Promise<McpToolResult> {
  const { site: siteQuery, newName } = args as unknown as RenameSiteArgs;

  const siteError = validateRequiredParam(siteQuery, 'site');
  if (siteError) return siteError;

  const nameError = validateRequiredParam(newName, 'newName');
  if (nameError) return nameError;

  if (!newName.trim()) {
    return createErrorResult('Error: newName cannot be empty');
  }

  const siteResult = findSiteOrError(siteQuery, services.siteData);
  if ('error' in siteResult) return siteResult.error;
  const { site } = siteResult;

  const oldName = site.name;

  try {
    // Check if updateSite method exists on siteData
    if (!services.siteData.updateSite) {
      return {
        content: [{ type: 'text', text: 'Site update service not available' }],
        isError: true,
      };
    }

    // Update the site name
    services.siteData.updateSite(site.id, { name: newName.trim() });

    return {
      content: [
        {
          type: 'text',
          text: `Successfully renamed site from "${oldName}" to "${newName.trim()}"`,
        },
      ],
    };
  } catch (error: any) {
    return {
      content: [{ type: 'text', text: `Failed to rename site: ${error.message}` }],
      isError: true,
    };
  }
}
