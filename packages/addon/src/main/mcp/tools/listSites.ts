/**
 * list_sites Tool
 * List all WordPress sites in Local
 */

import { McpToolDefinition, McpToolResult, LocalServices } from '../../../common/types';

export const listSitesDefinition: McpToolDefinition = {
  name: 'list_sites',
  description: 'List all WordPress sites in Local with their name, ID, status, and domain',
  inputSchema: {
    type: 'object',
    properties: {
      status: {
        type: 'string',
        enum: ['all', 'running', 'stopped'],
        description: 'Filter sites by status (default: all)',
      },
    },
  },
};

interface ListSitesArgs {
  status?: 'all' | 'running' | 'stopped';
}

export async function listSites(
  args: Record<string, unknown>,
  services: LocalServices
): Promise<McpToolResult> {
  const { status = 'all' } = args as ListSitesArgs;

  try {
    const sitesMap = services.siteData.getSites();
    const allSites = Object.values(sitesMap);

    // Get status for each site
    const sitesWithStatus = await Promise.all(
      allSites.map(async (site: any) => {
        const siteStatus = await services.siteProcessManager.getSiteStatus(site);
        return {
          id: site.id,
          name: site.name,
          status: siteStatus,
          domain: site.domain,
          path: site.path,
        };
      })
    );

    // Filter by status if requested
    let filteredSites = sitesWithStatus;
    if (status === 'running') {
      filteredSites = sitesWithStatus.filter((s) => s.status === 'running');
    } else if (status === 'stopped') {
      filteredSites = sitesWithStatus.filter((s) => s.status !== 'running');
    }

    const result = {
      count: filteredSites.length,
      sites: filteredSites,
    };

    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  } catch (error: any) {
    return {
      content: [{ type: 'text', text: `Failed to list sites: ${error.message}` }],
      isError: true,
    };
  }
}
