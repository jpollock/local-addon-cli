/**
 * rename_site Tool
 * Rename a WordPress site
 */

import { McpToolDefinition, McpToolResult, LocalServices } from '../../../common/types';
import { findSite } from './helpers';

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

  if (!siteQuery) {
    return {
      content: [{ type: 'text', text: 'Error: site parameter is required' }],
      isError: true,
    };
  }

  if (!newName) {
    return {
      content: [{ type: 'text', text: 'Error: newName parameter is required' }],
      isError: true,
    };
  }

  if (!newName.trim()) {
    return {
      content: [{ type: 'text', text: 'Error: newName cannot be empty' }],
      isError: true,
    };
  }

  try {
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

    const oldName = site.name;

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
