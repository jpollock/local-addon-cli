/**
 * stop_site Tool
 * Stop a WordPress site
 */

import { McpToolDefinition, McpToolResult, LocalServices } from '../../../common/types';
import { findSite } from './helpers';

export const stopSiteDefinition: McpToolDefinition = {
  name: 'stop_site',
  description: 'Stop a running WordPress site by name or ID',
  inputSchema: {
    type: 'object',
    properties: {
      site: {
        type: 'string',
        description: 'Site name or ID (partial names work)',
      },
    },
    required: ['site'],
  },
};

interface StopSiteArgs {
  site: string;
}

export async function stopSite(
  args: Record<string, unknown>,
  services: LocalServices
): Promise<McpToolResult> {
  const { site: siteQuery } = args as unknown as StopSiteArgs;

  if (!siteQuery) {
    return {
      content: [{ type: 'text', text: 'Error: site parameter is required' }],
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

    const currentStatus = await services.siteProcessManager.getSiteStatus(site);

    if (currentStatus !== 'running') {
      return {
        content: [{ type: 'text', text: `Site "${site.name}" is already stopped` }],
      };
    }

    await services.siteProcessManager.stop(site);

    return {
      content: [{ type: 'text', text: `Site "${site.name}" stopped successfully` }],
    };
  } catch (error: any) {
    return {
      content: [{ type: 'text', text: `Failed to stop site: ${error.message}` }],
      isError: true,
    };
  }
}
