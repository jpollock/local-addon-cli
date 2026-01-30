/**
 * toggle_xdebug Tool
 * Enable or disable Xdebug for a site
 */

import { McpToolDefinition, McpToolResult, LocalServices } from '../../../common/types';
import { validateRequiredParam, findSiteOrError, createErrorResult } from './helpers';

export const toggleXdebugDefinition: McpToolDefinition = {
  name: 'toggle_xdebug',
  description: 'Enable or disable Xdebug for a site (requires site restart to take effect)',
  inputSchema: {
    type: 'object',
    properties: {
      site: {
        type: 'string',
        description: 'Site name or ID',
      },
      enabled: {
        type: 'boolean',
        description: 'True to enable Xdebug, false to disable',
      },
    },
    required: ['site', 'enabled'],
  },
};

interface ToggleXdebugArgs {
  site: string;
  enabled: boolean;
}

export async function toggleXdebug(
  args: Record<string, unknown>,
  services: LocalServices
): Promise<McpToolResult> {
  const { site: siteQuery, enabled } = args as unknown as ToggleXdebugArgs;

  const paramError = validateRequiredParam(siteQuery, 'site');
  if (paramError) return paramError;

  if (typeof enabled !== 'boolean') {
    return createErrorResult('Error: enabled parameter must be true or false');
  }

  const siteResult = findSiteOrError(siteQuery, services.siteData);
  if ('error' in siteResult) return siteResult.error;
  const { site } = siteResult;

  try {
    // Check if updateSite method exists
    if (!services.siteData.updateSite) {
      return {
        content: [{ type: 'text', text: 'Site update service not available' }],
        isError: true,
      };
    }

    const previousState = site.xdebugEnabled ?? false;

    // Update the xdebugEnabled property
    services.siteData.updateSite(site.id, { xdebugEnabled: enabled });

    const action = enabled ? 'enabled' : 'disabled';
    const restartNote =
      previousState !== enabled ? ' Restart the site for changes to take effect.' : '';

    return {
      content: [
        {
          type: 'text',
          text: `Xdebug ${action} for "${site.name}".${restartNote}`,
        },
      ],
    };
  } catch (error: any) {
    return {
      content: [{ type: 'text', text: `Failed to toggle Xdebug: ${error.message}` }],
      isError: true,
    };
  }
}
