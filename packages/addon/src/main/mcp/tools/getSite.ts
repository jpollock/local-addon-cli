/**
 * get_site Tool
 * Get detailed information about a specific site
 */

import { McpToolDefinition, McpToolResult, LocalServices } from '../../../common/types';
import { findSite } from './helpers';

export const getSiteDefinition: McpToolDefinition = {
  name: 'get_site',
  description:
    'Get detailed information about a WordPress site including PHP version, web server, database, and WordPress version',
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

interface GetSiteArgs {
  site: string;
}

export async function getSite(
  args: Record<string, unknown>,
  services: LocalServices
): Promise<McpToolResult> {
  const { site: siteQuery } = args as unknown as GetSiteArgs;

  if (!siteQuery) {
    return {
      content: [{ type: 'text', text: 'Error: site parameter is required' }],
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

    const currentStatus = await services.siteProcessManager.getSiteStatus(site);

    const siteInfo = {
      id: site.id,
      name: site.name,
      status: currentStatus,
      domain: site.domain,
      path: site.path,
      url: `https://${site.domain}`,
      adminUrl: `https://${site.domain}/wp-admin`,
      environment: site.environment,
      services: {
        php: site.phpVersion || site.services?.php?.version,
        webServer:
          site.webServer || site.services?.nginx?.version || site.services?.apache?.version,
        database: site.mysql || site.services?.mysql?.version,
      },
      wordpress: {
        version: site.wordPressVersion,
        multisite: site.multisite || false,
      },
      hostConnections: site.hostConnections || [],
    };

    return {
      content: [{ type: 'text', text: JSON.stringify(siteInfo, null, 2) }],
    };
  } catch (error: any) {
    return {
      content: [{ type: 'text', text: `Failed to get site info: ${error.message}` }],
      isError: true,
    };
  }
}
