/**
 * start_site Tool
 * Start a WordPress site
 */

import { McpToolDefinition, McpToolResult, LocalServices } from '../../../common/types';
import { findSite } from './helpers';

export const startSiteDefinition: McpToolDefinition = {
  name: 'start_site',
  description: 'Start a WordPress site by name or ID',
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

interface StartSiteArgs {
  site: string;
}

export async function startSite(
  args: Record<string, unknown>,
  services: LocalServices
): Promise<McpToolResult> {
  const { site: siteQuery } = args as unknown as StartSiteArgs;

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
      return {
        content: [{ type: 'text', text: `Site "${site.name}" is already running` }],
      };
    }

    await services.siteProcessManager.start(site);

    return {
      content: [{ type: 'text', text: `Site "${site.name}" started successfully` }],
    };
  } catch (error: any) {
    return {
      content: [{ type: 'text', text: `Failed to start site: ${error.message}` }],
      isError: true,
    };
  }
}
