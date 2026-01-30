/**
 * clone_site Tool
 * Clone an existing WordPress site
 */

import { McpToolDefinition, McpToolResult, LocalServices } from '../../../common/types';
import { findSite } from './helpers';

export const cloneSiteDefinition: McpToolDefinition = {
  name: 'clone_site',
  description: 'Clone an existing WordPress site to create a copy with a new name',
  inputSchema: {
    type: 'object',
    properties: {
      site: {
        type: 'string',
        description: 'Site name or ID to clone',
      },
      new_name: {
        type: 'string',
        description: 'Name for the cloned site',
      },
    },
    required: ['site', 'new_name'],
  },
};

interface CloneSiteArgs {
  site: string;
  new_name: string;
}

export async function cloneSite(
  args: Record<string, unknown>,
  services: LocalServices
): Promise<McpToolResult> {
  const { site: siteQuery, new_name: newName } = args as unknown as CloneSiteArgs;

  if (!siteQuery) {
    return {
      content: [{ type: 'text', text: 'Error: site parameter is required' }],
      isError: true,
    };
  }

  if (!newName) {
    return {
      content: [{ type: 'text', text: 'Error: new_name parameter is required' }],
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

    // Check if cloneSite service exists
    if (!services.cloneSite) {
      return {
        content: [{ type: 'text', text: 'Clone site service not available' }],
        isError: true,
      };
    }

    // Clone the site
    const clonedSite = await services.cloneSite(site, newName);

    return {
      content: [
        {
          type: 'text',
          text: `Successfully cloned "${site.name}" to "${clonedSite.name}" (ID: ${clonedSite.id})`,
        },
      ],
    };
  } catch (error: any) {
    return {
      content: [{ type: 'text', text: `Failed to clone site: ${error.message}` }],
      isError: true,
    };
  }
}
