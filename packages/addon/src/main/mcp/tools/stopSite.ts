/**
 * stop_site Tool
 * Stop a WordPress site
 */

import { McpToolDefinition, McpToolResult, LocalServices } from '../../../common/types';
import { validateRequiredParam, findSiteOrError } from './helpers';

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

  // Validate required parameter
  const paramError = validateRequiredParam(siteQuery, 'site');
  if (paramError) return paramError;

  // Find site or return error
  const siteResult = findSiteOrError(siteQuery, services.siteData);
  if ('error' in siteResult) return siteResult.error;
  const { site } = siteResult;

  try {
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
