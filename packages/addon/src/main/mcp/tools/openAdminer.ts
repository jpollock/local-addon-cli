/**
 * open_adminer Tool
 * Open Adminer database management UI for a site
 */

import { McpToolDefinition, McpToolResult, LocalServices } from '../../../common/types';
import { validateRequiredParam, findSiteOrError } from './helpers';

export const openAdminerDefinition: McpToolDefinition = {
  name: 'open_adminer',
  description: 'Open Adminer database management UI for a site',
  inputSchema: {
    type: 'object',
    properties: {
      site: {
        type: 'string',
        description: 'Site name or ID',
      },
    },
    required: ['site'],
  },
};

interface OpenAdminerArgs {
  site: string;
}

export async function openAdminer(
  args: Record<string, unknown>,
  services: LocalServices
): Promise<McpToolResult> {
  const { site: siteQuery } = args as unknown as OpenAdminerArgs;

  const paramError = validateRequiredParam(siteQuery, 'site');
  if (paramError) return paramError;

  const siteResult = findSiteOrError(siteQuery, services.siteData);
  if ('error' in siteResult) return siteResult.error;
  const { site } = siteResult;

  try {
    // Check if adminer service exists
    if (!services.adminer) {
      return {
        content: [{ type: 'text', text: 'Adminer service not available' }],
        isError: true,
      };
    }

    // Open Adminer
    await services.adminer.open(site);

    return {
      content: [
        {
          type: 'text',
          text: `Opened Adminer for "${site.name}". Database admin UI should open in your browser.`,
        },
      ],
    };
  } catch (error: any) {
    return {
      content: [{ type: 'text', text: `Failed to open Adminer: ${error.message}` }],
      isError: true,
    };
  }
}
