/**
 * start_site Tool
 * Start a WordPress site
 */

import { McpToolDefinition, McpToolResult, LocalServices } from '../../../common/types';
import { validateRequiredParam, findSiteOrError } from './helpers';

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

  // Validate required parameter
  const paramError = validateRequiredParam(siteQuery, 'site');
  if (paramError) return paramError;

  // Find site or return error
  const siteResult = findSiteOrError(siteQuery, services.siteData);
  if ('error' in siteResult) return siteResult.error;
  const { site } = siteResult;

  try {
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
