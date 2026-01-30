/**
 * restart_site Tool
 * Restart a WordPress site
 */

import { McpToolDefinition, McpToolResult, LocalServices } from '../../../common/types';
import { validateRequiredParam, findSiteOrError } from './helpers';

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

  const paramError = validateRequiredParam(siteQuery, 'site');
  if (paramError) return paramError;

  const siteResult = findSiteOrError(siteQuery, services.siteData);
  if ('error' in siteResult) return siteResult.error;
  const { site } = siteResult;

  try {
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
