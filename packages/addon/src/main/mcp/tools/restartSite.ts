/**
 * restart_site Tool
 * Restart a WordPress site
 */

import { McpToolDefinition, McpToolResult, LocalServices } from '../../../common/types';
import { findSite } from './helpers';

export const restartSiteDefinition: McpToolDefinition = {
  name: 'restart_site',
  description: 'Restart a WordPress site by name or ID. If stopped, it will be started.',
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

interface RestartSiteArgs {
  site: string;
}

export async function restartSite(
  args: Record<string, unknown>,
  services: LocalServices
): Promise<McpToolResult> {
  const { site: siteQuery } = args as unknown as RestartSiteArgs;

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

    if (currentStatus === 'running') {
      await services.siteProcessManager.restart(site);
      return {
        content: [{ type: 'text', text: `Site "${site.name}" restarted successfully` }],
      };
    } else {
      // If not running, just start it
      await services.siteProcessManager.start(site);
      return {
        content: [{ type: 'text', text: `Site "${site.name}" was stopped, now started` }],
      };
    }
  } catch (error: any) {
    return {
      content: [{ type: 'text', text: `Failed to restart site: ${error.message}` }],
      isError: true,
    };
  }
}
