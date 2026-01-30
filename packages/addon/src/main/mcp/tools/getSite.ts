/**
 * get_site Tool
 * Get detailed information about a specific site
 */

import { McpToolDefinition, McpToolResult, LocalServices } from '../../../common/types';
import { validateRequiredParam, findSiteOrError } from './helpers';

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

  // Validate required parameter
  const paramError = validateRequiredParam(siteQuery, 'site');
  if (paramError) return paramError;

  // Find site or return error
  const siteResult = findSiteOrError(siteQuery, services.siteData);
  if ('error' in siteResult) return siteResult.error;
  const { site } = siteResult;

  try {
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
