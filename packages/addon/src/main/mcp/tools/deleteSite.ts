/**
 * delete_site Tool
 * Delete a WordPress site (requires confirmation)
 */

import { McpToolDefinition, McpToolResult, LocalServices } from '../../../common/types';
import { findSite } from './helpers';

export const deleteSiteDefinition: McpToolDefinition = {
  name: 'delete_site',
  description: 'Delete a WordPress site. Requires confirm=true to prevent accidental deletion.',
  inputSchema: {
    type: 'object',
    properties: {
      site: {
        type: 'string',
        description: 'Site name or ID (partial names work)',
      },
      confirm: {
        type: 'boolean',
        description: 'Must be true to confirm deletion. This is a safety measure.',
      },
      trashFiles: {
        type: 'boolean',
        description: 'Move site files to trash instead of permanent deletion (default: true)',
      },
    },
    required: ['site', 'confirm'],
  },
};

interface DeleteSiteArgs {
  site: string;
  confirm: boolean;
  trashFiles?: boolean;
}

export async function deleteSite(
  args: Record<string, unknown>,
  services: LocalServices
): Promise<McpToolResult> {
  const { site: siteQuery, confirm, trashFiles = true } = args as unknown as DeleteSiteArgs;

  if (!siteQuery) {
    return {
      content: [{ type: 'text', text: 'Error: site parameter is required' }],
      isError: true,
    };
  }

  if (confirm !== true) {
    return {
      content: [
        {
          type: 'text',
          text: 'Error: Deletion not confirmed. You must set confirm=true to delete a site. This is a safety measure to prevent accidental deletion.',
        },
      ],
      isError: true,
    };
  }

  try {
    const site = findSite(siteQuery, services.siteData);

    if (!site) {
      const sitesMap = services.siteData.getSites();
      const allSites = Object.values(sitesMap) as any[];
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

    // Stop the site if it's running
    const currentStatus = await services.siteProcessManager.getSiteStatus(site);
    if (currentStatus === 'running') {
      await services.siteProcessManager.stop(site);
    }

    // Delete the site
    await services.deleteSite.deleteSite({
      site,
      trashFiles,
      updateHosts: true,
    });

    const result = {
      success: true,
      message: `Site "${site.name}" deleted successfully`,
      trashFiles,
    };

    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  } catch (error: any) {
    return {
      content: [{ type: 'text', text: `Failed to delete site: ${error.message}` }],
      isError: true,
    };
  }
}
