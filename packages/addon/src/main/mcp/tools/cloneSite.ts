/**
 * clone_site Tool
 * Clone an existing WordPress site
 */

import { McpToolDefinition, McpToolResult, LocalServices } from '../../../common/types';
import { validateRequiredParam, findSiteOrError } from './helpers';

export const cloneSiteDefinition: McpToolDefinition = {
  name: 'clone_site',
  description: 'Clone an existing WordPress site to create a copy with a new name',
  inputSchema: {
    type: 'object',
    properties: {
      site: {
        type: 'string',
        description: 'Site name or ID to clone',
      },
      new_name: {
        type: 'string',
        description: 'Name for the cloned site',
      },
    },
    required: ['site', 'new_name'],
  },
};

interface CloneSiteArgs {
  site: string;
  new_name: string;
}

export async function cloneSite(
  args: Record<string, unknown>,
  services: LocalServices
): Promise<McpToolResult> {
  const { site: siteQuery, new_name: newName } = args as unknown as CloneSiteArgs;

  const siteError = validateRequiredParam(siteQuery, 'site');
  if (siteError) return siteError;

  const nameError = validateRequiredParam(newName, 'new_name');
  if (nameError) return nameError;

  const siteResult = findSiteOrError(siteQuery, services.siteData);
  if ('error' in siteResult) return siteResult.error;
  const { site } = siteResult;

  try {
    // Check if cloneSite service exists
    if (!services.cloneSite) {
      return {
        content: [{ type: 'text', text: 'Clone site service not available' }],
        isError: true,
      };
    }

    // Clone the site
    const clonedSite = await services.cloneSite(site, newName);

    return {
      content: [
        {
          type: 'text',
          text: `Successfully cloned "${site.name}" to "${clonedSite.name}" (ID: ${clonedSite.id})`,
        },
      ],
    };
  } catch (error: any) {
    return {
      content: [{ type: 'text', text: `Failed to clone site: ${error.message}` }],
      isError: true,
    };
  }
}
